import { DEFAULT_APP_TIMEOUT, SWAP_STATE_TIMEOUT } from "@connext/apps";
import {
  DefaultApp,
  EventNames,
  MethodParams,
  PublicParams,
  PublicResults,
  SimpleSwapAppState,
  SimpleTwoPartySwapAppName,
  Address,
  CONVENTION_FOR_ETH_ASSET_ID,
} from "@connext/types";
import {
  calculateExchangeWad,
  delay,
  getAddressFromAssetId,
  getAddressError,
  notGreaterThan,
  notLessThanOrEqualTo,
  notPositive,
  toBN,
  stringify,
  fromWad,
  toWad,
} from "@connext/utils";
import { ERC20 } from "@connext/contracts";
import { BigNumber, constants, Contract } from "ethers";

import { AbstractController } from "./AbstractController";

const { AddressZero, Zero } = constants;

export class SwapController extends AbstractController {
  public async swap(params: PublicParams.Swap): Promise<PublicResults.Swap> {
    this.log.info(`swap started: ${stringify(params)}`);
    const amount = toBN(params.amount);
    const { swapRate } = params;

    const toTokenAddress = getAddressFromAssetId(params.toAssetId);
    const fromTokenAddress = getAddressFromAssetId(params.fromAssetId);

    const preSwapFromBal = await this.connext.getFreeBalance(fromTokenAddress);
    const userBal = preSwapFromBal[this.connext.signerAddress];

    this.throwIfAny(
      getAddressError(fromTokenAddress),
      getAddressError(toTokenAddress),
      notLessThanOrEqualTo(amount, userBal),
      notGreaterThan(amount, Zero),
      notPositive(toWad(swapRate)),
      notLessThanOrEqualTo(amount, toBN(preSwapFromBal[this.connext.signerAddress])),
    );

    // get app definition
    const network = await this.ethProvider.getNetwork();
    const appInfo = (await this.connext.getAppRegistry({
      name: SimpleTwoPartySwapAppName,
      chainId: network.chainId,
    })) as DefaultApp;

    this.log.debug(`Requesting collateral`);

    // TODO: don't do as any
    const tx = await this.connext.requestCollateral(toTokenAddress) as any;
    if (tx && tx.hash) {
      await this.ethProvider.waitForTransaction(tx.hash);
      await this.connext.waitFor(EventNames.UNINSTALL_EVENT, 10_000);
    } else {
      // TODO: something smarter
      await delay(5000);
    }

    this.log.debug(`Installing swap app`);

    const appIdentityHash = await this.swapAppInstall(
      amount,
      toTokenAddress,
      fromTokenAddress,
      swapRate,
      appInfo,
    );
    this.log.debug(`Swap app installed: ${appIdentityHash}, uninstalling`);

    // if app installed, that means swap was accepted now uninstall

    try {
      await this.connext.uninstallApp(appIdentityHash);
    } catch (e) {
      const msg = `Failed to uninstall swap: ${e.stack || e.message}`;
      this.log.error(msg);
      throw new Error(msg);
    }

    const res = await this.connext.getChannel();

    this.log.info(
      `swap from ${fromTokenAddress} to ${toTokenAddress} completed: ${stringify(res)}`,
    );
    // TODO: fix the state / types!!
    return res as PublicResults.Swap;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS

  private swapAppInstall = async (
    initiatorDeposit: BigNumber,
    toTokenAddress: Address,
    fromTokenAddress: Address,
    swapRate: string,
    appInfo: DefaultApp,
  ): Promise<string> => {
    const getDecimals = async (tokenAddress: string): Promise<number> => {
      let decimals = 18;
      if (tokenAddress !== CONVENTION_FOR_ETH_ASSET_ID) {
        try {
          const token = new Contract(tokenAddress, ERC20.abi, this.connext.ethProvider);
          decimals = await token.functions.decimals();
          this.log.info(`Retrieved decimals for ${tokenAddress} from token contract: ${decimals}`);
        } catch (error) {
          this.log.warn(
            `Could not retrieve decimals from token ${tokenAddress}, defaulting to 18`,
          );
        }
      }
      return decimals;
    };

    const fromDecimals = await getDecimals(fromTokenAddress);
    const toDecimals = await getDecimals(toTokenAddress);

    const responderDeposit = calculateExchangeWad(
      initiatorDeposit,
      fromDecimals,
      swapRate,
      toDecimals,
    );

    this.log.debug(
      `Swapping ${fromWad(initiatorDeposit, fromDecimals)} ${
        toTokenAddress === AddressZero ? "ETH" : "Tokens"
      } for ${fromWad(responderDeposit, toDecimals)} ${
        fromTokenAddress === AddressZero ? "ETH" : "Tokens"
      }`,
    );

    // NOTE: always put the initiators swap information FIRST
    // followed by responders. If this is not included, the swap will
    // fail, causing the balances to be indexed on the wrong token
    // address key in `get-outcome-increments.ts` in cf code base
    // ideally this would be fixed at some point
    const initialState: SimpleSwapAppState = {
      coinTransfers: [
        [
          {
            amount: initiatorDeposit,
            to: this.connext.signerAddress,
          },
        ],
        [
          {
            amount: responderDeposit,
            to: this.connext.nodeSignerAddress,
          },
        ],
      ],
    };

    const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding } = appInfo;

    const params: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit,
      initiatorDepositAssetId: fromTokenAddress,
      multisigAddress: this.connext.multisigAddress,
      outcomeType: appInfo.outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit,
      responderDepositAssetId: toTokenAddress,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: SWAP_STATE_TIMEOUT,
    };

    this.log.debug(`Installing app with params: ${stringify(params)}`);
    const appIdentityHash = await this.proposeAndInstallLedgerApp(params);
    return appIdentityHash;
  };
}
