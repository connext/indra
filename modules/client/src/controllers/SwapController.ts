import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify, formatEther, parseEther } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { stringify, xpubToAddress } from "../lib";
import {
  CFCoreChannel,
  CFCoreTypes,
  convert,
  RegisteredAppDetails,
  SimpleSwapAppStateBigNumber,
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

export const calculateExchange = (amount: BigNumber, swapRate: string): BigNumber => {
  return bigNumberify(formatEther(amount.mul(parseEther(swapRate))).replace(/\.[0-9]*$/, ""));
};

export class SwapController extends AbstractController {
  private appId: string;
  private timeout: NodeJS.Timeout;

  public async swap(params: SwapParameters): Promise<CFCoreChannel> {
    // convert params + validate
    const { amount, toAssetId, fromAssetId, swapRate } = convert.SwapParameters(
      "bignumber",
      params,
    );
    const preSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const userBal = preSwapFromBal[this.connext.freeBalanceAddress];
    const preSwapToBal = await this.connext.getFreeBalance(toAssetId);
    const nodeBal = preSwapToBal[xpubToAddress(this.connext.nodePublicIdentifier)];
    const swappedAmount = calculateExchange(amount, swapRate);
    validate(
      invalidAddress(fromAssetId),
      invalidAddress(toAssetId),
      notLessThanOrEqualTo(amount, userBal),
      notGreaterThan(amount, Zero),
      notLessThanOrEqualTo(swappedAmount, nodeBal),
      notPositive(parseEther(swapRate)),
    );

    // get app definition from constants
    const appInfo = this.connext.getRegisteredAppDetails("SimpleTwoPartySwapApp");

    // install the swap app
    await this.swapAppInstall(amount, toAssetId, fromAssetId, swapRate, appInfo);

    this.log.info(`Swap app installed! Uninstalling without updating state.`);

    // if app installed, that means swap was accepted
    // now uninstall
    await this.connext.uninstallApp(this.appId);

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
  // TODO: fix type of data
  private resolveInstallSwap = (res: (value?: unknown) => void, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    res(data);
    return data;
  };

  // TODO: fix types of data, they seem to have different strucs
  // depending on when theyre emitted :thinking:
  private rejectInstallSwap = (rej: any, msg: { data: { appInstanceId: string } }): any => {
    // check app id
    const appId = msg.data ? msg.data.appInstanceId : (msg as any).appInstanceId;
    if (!msg.data) {
      this.log.warn(
        `This should not have this structure when emitted, strange. msg: ${stringify(msg)}`,
      );
    }

    if (this.appId !== appId) {
      return;
    }

    rej(`Install rejected. Event data: ${stringify(msg.data)}`);
    return msg.data;
  };

  // TODO: fix for virtual exchanges!
  private swapAppInstall = async (
    amount: BigNumber,
    toAssetId: string,
    fromAssetId: string,
    swapRate: string,
    appInfo: RegisteredAppDetails,
  ): Promise<any> => {
    let boundResolve;
    let boundReject;

    const swappedAmount = calculateExchange(amount, swapRate);

    this.log.info(
      `Installing swap app. Swapping ${amount.toString()} of ${fromAssetId}` +
        ` for ${swappedAmount.toString()} of ${toAssetId}`,
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
            to: fromExtendedKey(this.connext.publicIdentifier).derivePath("0").address,
          },
        ],
        [
          {
            amount: swappedAmount,
            to: fromExtendedKey(this.connext.nodePublicIdentifier).derivePath("0").address,
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
      initiatorDeposit: amount, // TODO will this work?
      initiatorDepositTokenAddress: fromAssetId,
      outcomeType: appInfo.outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: swappedAmount, // TODO will this work? ERC20 context?
      responderDepositTokenAddress: toAssetId,
      timeout: Zero,
    };

    const res = await this.connext.proposeInstallApp(params);

    // set app instance id
    this.appId = res.appInstanceId;

    await new Promise((res: any, rej: any): any => {
      boundReject = this.rejectInstallSwap.bind(null, rej);
      boundResolve = this.resolveInstallSwap.bind(null, res);
      this.listener.on(CFCoreTypes.EventName.INSTALL, boundResolve);
      this.listener.on(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
      // this.timeout = setTimeout(() => {
      //   this.log.info("Install swap app timed out, rejecting install.")
      //   this.cleanupInstallListeners(boundResolve, boundReject);
      //   boundReject({ data: { appInstanceId: this.appId } });
      // }, 5000);
    });

    this.cleanupInstallListeners(boundResolve, boundReject);
    return res.appInstanceId;
  };

  private cleanupInstallListeners = (boundResolve: any, boundReject: any): void => {
    this.listener.removeListener(CFCoreTypes.EventName.INSTALL, boundResolve);
    this.listener.removeListener(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
  };
}
