import { DEFAULT_APP_TIMEOUT, SWAP_STATE_TIMEOUT } from "@connext/apps";
import {
  calculateExchange,
  DefaultApp,
  MethodParams,
  PublicParams,
  PublicResults,
  SimpleSwapAppState,
  toBN,
} from "@connext/types";
import { xkeyKthAddress as addressToAddress } from "@connext/cf-core";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, formatEther, getAddress, parseEther } from "ethers/utils";

import { CF_METHOD_TIMEOUT, delayAndThrow } from "../lib";
import {
  invalidAddress,
  notGreaterThan,
  notLessThanOrEqualTo,
  notPositive,
  validate,
} from "../validation";

import { AbstractController } from "./AbstractController";

export class SwapController extends AbstractController {
  public async swap(params: PublicParams.Swap): Promise<PublicResults.Swap> {
    const amount = toBN(params.amount);
    const { swapRate } = params;
    const toAssetId = getAddress(params.toAssetId);
    const fromAssetId = getAddress(params.fromAssetId);
    const preSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const preSwapToBal = await this.connext.getFreeBalance(toAssetId);
    const userBal = preSwapFromBal[this.connext.signerAddress];
    const swappedAmount = calculateExchange(amount, swapRate);


    validate(
      invalidAddress(fromAssetId),
      invalidAddress(toAssetId),
      notLessThanOrEqualTo(amount, userBal),
      notGreaterThan(amount, Zero),
      notPositive(parseEther(swapRate)),
    );

    const error = notLessThanOrEqualTo(
      amount,
      toBN(preSwapFromBal[this.connext.signerAddress]),
    );
    if (error) {
      throw new Error(error);
    }

    // get app definition from constants
    const appInfo = this.connext.getRegisteredAppDetails("SimpleTwoPartySwapApp");

    // install the swap app
    const appIdentityHash = await this.swapAppInstall(
      amount,
      toAssetId,
      fromAssetId,
      swapRate,
      appInfo,
    );
    this.log.info(`Swap app installed! Uninstalling without updating state.`);

    // if app installed, that means swap was accepted now uninstall
    try {
      await Promise.race([
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App uninstall took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
        this.connext.uninstallApp(appIdentityHash),
      ]);
    } catch (e) {
      const msg = `Failed to uninstall swap: ${e.stack || e.message}`;
      this.log.error(msg);
      throw new Error(msg);
    }

    // Sanity check to ensure swap was executed correctly
    const postSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const postSwapToBal = await this.connext.getFreeBalance(toAssetId);
    // balance decreases
    const diffFrom = preSwapFromBal[this.connext.signerAddress].sub(
      postSwapFromBal[this.connext.signerAddress],
    );
    // balance increases
    const diffTo = postSwapToBal[this.connext.signerAddress].sub(
      preSwapToBal[this.connext.signerAddress],
    );
    if (!diffFrom.eq(amount) || !diffTo.eq(swappedAmount)) {
      throw new Error("Invalid final swap amounts - this shouldn't happen!!");
    }
    const res = await this.connext.getChannel();

    // TODO: fix the state / types!!
    return res as PublicResults.Swap;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS

  // TODO: fix for virtual exchanges!
  private swapAppInstall = async (
    amount: BigNumber,
    toAssetId: string,
    fromAssetId: string,
    swapRate: string,
    appInfo: DefaultApp,
  ): Promise<string> => {
    const swappedAmount = calculateExchange(amount, swapRate);

    this.log.info(
      `Swapping ${formatEther(amount)} ${
        fromAssetId === AddressZero ? "ETH" : "Tokens"
      } for ${formatEther(swappedAmount)} ${toAssetId === AddressZero ? "ETH" : "Tokens"}`,
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
            amount,
            to: this.connext.signerAddress,
          },
        ],
        [
          {
            amount: swappedAmount,
            to: addressToAddress(this.connext.nodePublicIdentifier),
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
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: fromAssetId,
      outcomeType: appInfo.outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: swappedAmount,
      responderDepositTokenAddress: toAssetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: SWAP_STATE_TIMEOUT,
    };

    const appIdentityHash = await this.proposeAndInstallLedgerApp(params);
    this.log.info(`Successfully installed swap app with id ${appIdentityHash}`);
    return appIdentityHash;
  };
}
