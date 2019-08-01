import {
  ConditionalTransferInitialStateBigNumber,
  convert,
  RegisteredAppDetails,
  ResolveConditionParameters,
  ResolveConditionResponse,
  ResolveLinkedTransferParameters,
  ResolveLinkedTransferResponse,
  SupportedApplication,
  SupportedApplications,
  TransferCondition,
  UnidirectionalLinkedTransferAppActionBigNumber,
  UnidirectionalLinkedTransferAppStage,
  UnidirectionalLinkedTransferAppStateBigNumber,
} from "@connext/types";
import { RejectProposalMessage } from "@counterfactual/node";
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { delay, freeBalanceAddressFromXpub } from "../lib/utils";

import { AbstractController } from "./AbstractController";
import { createLinkedHash } from "./ConditionalTransferController";

type ConditionResolvers = {
  [index in TransferCondition]: (
    params: ResolveConditionParameters,
  ) => Promise<ResolveConditionResponse>;
};
export class ResolveConditionController extends AbstractController {
  private appId: string;

  private timeout: NodeJS.Timeout;

  public resolve = async (
    params: ResolveConditionParameters,
  ): Promise<ResolveConditionResponse> => {
    this.log.info(`Resolve condition called with parameters: ${JSON.stringify(params, null, 2)}`);

    const res = await this.conditionResolvers[params.conditionType](params);
    return res;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS
  private resolveLinkedTransfer = async (
    params: ResolveLinkedTransferParameters,
  ): Promise<ResolveLinkedTransferResponse> => {
    // convert and validate
    const { paymentId, preImage, amount, assetId } = convert.ResolveLinkedTransfer(
      "bignumber",
      params,
    );

    const invalid = await this.validateLinked(paymentId, preImage, amount, assetId);
    if (invalid) {
      throw new Error(invalid);
    }

    const freeBal = await this.connext.getFreeBalance(assetId);
    const preTransferBal = freeBal[this.connext.freeBalanceAddress];

    // get appInfo
    const appInfo = this.connext.getRegisteredAppDetails(
      SupportedApplications.UnidirectionalLinkedTransferApp as SupportedApplication,
    );

    // generate hash
    const linkedHash = createLinkedHash({ amount, assetId, paymentId, preImage });

    // create initial state
    const initialState: UnidirectionalLinkedTransferAppStateBigNumber = {
      finalized: false,
      linkedHash,
      stage: UnidirectionalLinkedTransferAppStage.POST_FUND,
      transfers: [
        {
          amount,
          to: freeBalanceAddressFromXpub(this.connext.publicIdentifier),
          // TODO: replace? fromExtendedKey(this.publicIdentifier).derivePath("0").address
        },
        {
          amount: Zero,
          to: freeBalanceAddressFromXpub(this.connext.nodePublicIdentifier),
        },
      ],
      turnNum: Zero,
    };

    const appId = await this.conditionalTransferAppInstalled(
      amount,
      assetId,
      initialState,
      appInfo,
    );
    if (!appId) {
      throw new Error(`App was not installed`);
    }

    // finalize
    await this.finalizeAndUninstallApp(amount, assetId, paymentId, preImage);

    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.connext.getFreeBalance(assetId);
    const diff = postTransferBal[this.connext.freeBalanceAddress].sub(preTransferBal);
    if (!diff.eq(amount)) {
      this.log.info(
        "Welp it appears the difference of the free balance before and after " +
          "uninstalling is not what we expected......",
      );
    } else if (postTransferBal[this.connext.freeBalanceAddress].lte(preTransferBal)) {
      this.log.info(
        "Free balance after transfer is lte free balance " +
          "before transfer..... That's not great..",
      );
    }

    return {
      freeBalance: await this.connext.getFreeBalance(assetId),
      paymentId,
    };
  };

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private conditionalTransferAppInstalled = async (
    responderDeposit: BigNumber,
    assetId: string,
    initialState: ConditionalTransferInitialStateBigNumber,
    appInfo: RegisteredAppDetails,
  ): Promise<string | undefined> => {
    let boundResolve: (value?: any) => void;
    let boundReject: (reason?: any) => void;

    // note: intermediary is added in connext.ts as well
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
    } = appInfo;
    const params: NodeTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const res = await this.connext.proposeInstallApp(params);
    // set app instance id
    this.appId = res.appInstanceId;

    try {
      await new Promise((res: () => any, rej: () => any): void => {
        boundReject = this.rejectInstallTransfer.bind(null, rej);
        boundResolve = this.resolveInstallTransfer.bind(null, res);
        this.listener.on(NodeTypes.EventName.INSTALL, boundResolve);
        this.listener.on(NodeTypes.EventName.REJECT_INSTALL, boundReject);
      });
      this.log.info(`App was installed successfully!: ${JSON.stringify(res)}`);
      return res.appInstanceId;
    } catch (e) {
      this.log.error(`Error installing app: ${e.toString()}`);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundResolve, boundReject);
    }
  };

  private finalizeAndUninstallApp = async (
    amount: BigNumber,
    assetId: string,
    paymentId: string,
    preImage: string,
  ): Promise<void> => {
    const action: UnidirectionalLinkedTransferAppActionBigNumber = {
      amount,
      assetId,
      paymentId,
      preImage,
    };
    await this.connext.takeAction(this.appId, action);

    // display final state of app
    const appInfo = await this.connext.getAppState(this.appId);
    (appInfo.state as any).transfers[0][1] = (appInfo.state as any).transfers[0][1].toString();
    (appInfo.state as any).transfers[1][1] = (appInfo.state as any).transfers[1][1].toString();
    this.log.info(`******** app state finalized: ${JSON.stringify(appInfo, null, 2)}`);

    await this.connext.uninstallApp(this.appId);
    // TODO: cf does not emit uninstall virtual event on the node
    // that has called this function but ALSO does not immediately
    // uninstall the apps. This will be a problem when trying to
    // display balances...
    const openApps = await this.connext.getAppInstances();
    this.log.info(`Open apps: ${openApps.length}`);
    this.log.info(`AppIds: ${JSON.stringify(openApps.map(a => a.identityHash))}`);

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    await new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
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
      },
    );
  };

  // TODO: fix type of data
  private resolveInstallTransfer = (res: (value?: unknown) => void, data: any): any => {
    if (this.appId !== data.params.appInstanceId) {
      this.log.info(
        `Caught INSTALL event for different app ${JSON.stringify(data)}, expected ${this.appId}`,
      );
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    res(data);
    return data;
  };

  // TODO: fix types of data
  private rejectInstallTransfer = (
    rej: (reason?: any) => void,
    msg: RejectProposalMessage, // reject install??
  ): any => {
    // check app id
    if (this.appId !== msg.data.appInstanceId) {
      return;
    }

    return rej(`Install failed. Event data: ${JSON.stringify(msg, null, 2)}`);
  };

  private cleanupInstallListeners = (boundResolve: any, boundReject: any): void => {
    this.listener.removeListener(NodeTypes.EventName.INSTALL, boundResolve);
    this.listener.removeListener(NodeTypes.EventName.REJECT_INSTALL, boundReject);
  };

  private validateLinked = async (
    paymentId: string,
    preImage: string,
    amount: BigNumber,
    assetId: string,
  ): Promise<string | undefined> => {
    return undefined;
  };

  private conditionResolvers: ConditionResolvers = {
    LINKED_TRANSFER: this.resolveLinkedTransfer,
  };
}
