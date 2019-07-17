import { convert, NodeChannel, SwapParameters } from "@connext/types";
import { RejectInstallVirtualMessage } from "@counterfactual/node";
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { delay, freeBalanceAddressFromXpub } from "../lib/utils";
import { invalidAddress } from "../validation/addresses";
import { falsy, notLessThanOrEqualTo, notPositive } from "../validation/bn";

import { AbstractController } from "./AbstractController";

export class SwapController extends AbstractController {
  private appId: string;
  private timeout: NodeJS.Timeout;

  public async swap(params: SwapParameters): Promise<NodeChannel> {
    // convert params + validate
    const { amount, toAssetId, fromAssetId, swapRate } = convert.SwapParameters(
      "bignumber",
      params,
    );
    const invalid = await this.validate(amount, toAssetId, fromAssetId, swapRate);
    if (invalid) {
      throw new Error(invalid.toString());
    }

    // For below sanity check
    const preSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const preSwapToBal = await this.connext.getFreeBalance(toAssetId);

    // get app definition from constants
    const appInfo = this.connext.getRegisteredAppDetails("SimpleTwoPartySwapApp");

    // install the swap app
    await this.swapAppInstall(amount, toAssetId, fromAssetId, swapRate, appInfo);

    // if app installed, that means swap was accepted
    // now uninstall
    await this.swapAppUninstall(this.appId);

    // Sanity check to ensure swap was executed correctly
    const postSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const postSwapToBal = await this.connext.getFreeBalance(toAssetId);
    // TODO is this the right syntax? Waiting on ERC20 merge
    const diffFrom = preSwapFromBal[this.cfModule.ethFreeBalanceAddress].sub(
      postSwapFromBal[this.cfModule.ethFreeBalanceAddress],
    );
    const diffTo = preSwapToBal[this.cfModule.ethFreeBalanceAddress].sub(
      postSwapToBal[this.cfModule.ethFreeBalanceAddress],
    );
    if (!diffFrom.eq(amount) || !diffTo.eq(amount.mul(swapRate))) {
      throw new Error("Invalid final swap amounts - this shouldn't happen!!");
    }
    const newState = await this.connext.getChannel();

    // TODO: fix the state / types!!
    return newState as NodeChannel;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS
  private validate = async (
    amount: BigNumber,
    toAssetId: string,
    fromAssetId: string,
    swapRate: BigNumber,
  ): Promise<undefined | string> => {
    // check that there is sufficient free balance for amount
    const preSwapFromBal = await this.connext.getFreeBalance(fromAssetId);
    const userBal = preSwapFromBal[this.cfModule.ethFreeBalanceAddress];
    const preSwapToBal = await this.connext.getFreeBalance(toAssetId);
    const nodeBal = preSwapToBal[freeBalanceAddressFromXpub(this.connext.nodePublicIdentifier)];
    const errs = [
      invalidAddress(fromAssetId),
      invalidAddress(toAssetId),
      notLessThanOrEqualTo(amount, userBal),
      notLessThanOrEqualTo(amount.mul(swapRate), nodeBal),
      notPositive(swapRate),
    ];
    return errs ? errs.filter(falsy)[0] : undefined;
  };

  // TODO: fix type of data
  private resolveInstallSwap = (res: any, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    res(data);
    return data;
  };

  // TODO: fix types of data
  private rejectInstallSwap = (rej: any, msg: RejectInstallVirtualMessage): any => {
    // check app id
    if (this.appId !== msg.data.appInstanceId) {
      return;
    }

    rej(`Install virtual rejected. Event data: ${JSON.stringify(msg.data, null, 2)}`);
    return msg.data;
  };

  private swapAppInstall = async (
    amount: BigNumber,
    toAssetId: string,
    fromAssetId: string,
    swapRate: BigNumber,
    appInfo: any,
  ): Promise<any> => {
    let boundResolve;
    let boundReject;

    const params: NodeTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding: appInfo.actionEncoding,
        stateEncoding: appInfo.stateEncoding,
      },
      appDefinition: appInfo.appDefinitionAddress,
      initialState: {
        coinBalances: [
          {
            balance: [amount, Zero],
            coinAddress: [fromAssetId, toAssetId],
            to: fromExtendedKey(this.connext.publicIdentifier).derivePath("0").address,
          },
          {
            balance: [Zero, amount.mul(swapRate)],
            coinAddress: [fromAssetId, toAssetId],
            to: fromExtendedKey(this.connext.nodePublicIdentifier).derivePath("0").address,
          },
        ],
        finalized: false,
      } as any,
      initiatorDeposit: amount, // TODO will this work?
      initiatorDepositTokenAddress: fromAssetId,
      outcomeType: appInfo.outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: amount.mul(swapRate), // TODO will this work? ERC20 context?
      responderDepositTokenAddress: toAssetId,
      timeout: Zero,
    };

    const res = await this.connext.proposeInstallApp(params);

    // set app instance id
    this.appId = res.appInstanceId;

    await new Promise((res, rej) => {
      boundReject = this.rejectInstallSwap.bind(null, rej);
      boundResolve = this.resolveInstallSwap.bind(null, res);
      this.listener.on(NodeTypes.EventName.INSTALL_VIRTUAL, boundResolve);
      this.listener.on(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
      this.timeout = setTimeout(() => {
        this.cleanupInstallListeners(boundResolve, boundReject);
        boundReject({ data: { appInstanceId: this.appId } });
      }, 5000);
    });

    this.cleanupInstallListeners(boundResolve, boundReject);
    return res.appInstanceId;
  };

  private cleanupInstallListeners = (boundResolve: any, boundReject: any): void => {
    this.listener.removeListener(NodeTypes.EventName.INSTALL_VIRTUAL, boundResolve);
    this.listener.removeListener(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
  };

  private swapAppUninstall = async (appId: string): Promise<void> => {
    await this.connext.uninstallVirtualApp(appId);
    // TODO: cf does not emit uninstall virtual event on the node
    // that has called this function but ALSO does not immediately
    // uninstall the apps. This will be a problem when trying to
    // display balances...
    const openApps = await this.connext.getAppInstances();
    this.log.info(`Open apps: ${openApps.length}`);
    this.log.info(`AppIds: ${JSON.stringify(openApps.map(a => a.identityHash))}`);

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    await new Promise(async (res, rej) => {
      const getAppIds = async (): Promise<string[]> => {
        return (await this.connext.getAppInstances()).map((a: AppInstanceInfo) => a.identityHash);
      };
      let retries = 0;
      while ((await getAppIds()).indexOf(this.appId) !== -1 && retries <= 5) {
        this.log.info("found app id in the open apps... retrying...");
        await delay(500);
        retries = retries + 1;
      }

      if (retries > 5) rej();

      res();
    });
  };
}
