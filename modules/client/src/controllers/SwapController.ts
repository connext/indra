import { SimpleSwapAppStateBigNumber } from "@connext/apps";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber, formatEther, parseEther } from "ethers/utils";

import { CF_METHOD_TIMEOUT, delayAndThrow } from "../lib";
import { xpubToAddress } from "../lib/cfCore";
import {
  calculateExchange,
  CFCoreChannel,
  CFCoreTypes,
  convert,
  DefaultApp,
  SwapParameters,
} from "../types";
import {
  invalidAddress,
  notGreaterThan,
  notLessThanOrEqualTo,
  notPositive,
  validate,
} from "../validation";

import { AbstractController } from "./AbstractController";

export class SwapController extends AbstractController {
  public async swap(params: SwapParameters): Promise<CFCoreChannel> {
    // convert params + validate
    const { amount, toAssetId, fromAssetId, swapRate } = convert.SwapParameters(
      "bignumber",
      params,
    );
    const preSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const userBal = preSwapFromBal[this.connext.freeBalanceAddress];
    const preSwapToBal = await this.connext.getFreeBalance(toAssetId);
    const swappedAmount = calculateExchange(amount, swapRate);
    validate(
      invalidAddress(fromAssetId),
      invalidAddress(toAssetId),
      notLessThanOrEqualTo(amount, userBal),
      notGreaterThan(amount, Zero),
      notPositive(parseEther(swapRate)),
    );

    // get app definition from constants
    const appInfo = this.connext.getRegisteredAppDetails("SimpleTwoPartySwapApp");

    // install the swap app
    const appId = await this.swapAppInstall(amount, toAssetId, fromAssetId, swapRate, appInfo);
    this.log.info(`Swap app installed! Uninstalling without updating state.`);

    // if app installed, that means swap was accepted now uninstall
    try {
      await Promise.race([
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App uninstall took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
        this.connext.uninstallApp(appId),
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
    const diffFrom = preSwapFromBal[this.connext.freeBalanceAddress].sub(
      postSwapFromBal[this.connext.freeBalanceAddress],
    );
    // balance increases
    const diffTo = postSwapToBal[this.connext.freeBalanceAddress].sub(
      preSwapToBal[this.connext.freeBalanceAddress],
    );
    if (!diffFrom.eq(amount) || !diffTo.eq(swappedAmount)) {
      throw new Error("Invalid final swap amounts - this shouldn't happen!!");
    }
    const newState = await this.connext.getChannel();

    // TODO: fix the state / types!!
    return newState as CFCoreChannel;
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
    const initialState: SimpleSwapAppStateBigNumber = {
      coinTransfers: [
        [
          {
            amount,
            to: this.connext.freeBalanceAddress,
          },
        ],
        [
          {
            amount: swappedAmount,
            to: xpubToAddress(this.connext.nodePublicIdentifier),
          },
        ],
      ],
    };

    const { actionEncoding, appDefinitionAddress: appDefinition, stateEncoding } = appInfo;

    const params: CFCoreTypes.ProposeInstallParams = {
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
      timeout: Zero,
    };

    const appInstanceId = await this.proposeAndInstallLedgerApp(params);
    this.log.info(`Successfully installed swap app with id ${appInstanceId}`);
    return appInstanceId;
  };
}
