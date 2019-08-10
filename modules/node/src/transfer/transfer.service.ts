import {
  ConditionalTransferInitialStateBigNumber,
  ResolveLinkedTransferResponse,
  SupportedApplications,
  UnidirectionalLinkedTransferAppActionBigNumber,
  UnidirectionalLinkedTransferAppStage,
  UnidirectionalLinkedTransferAppStateBigNumber,
} from "@connext/types";
import { ProposeVirtualMessage, RejectProposalMessage } from "@counterfactual/node";
import { AppInstanceJson, Node as NodeTypes } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import { Network } from "../constants";
import { NodeService } from "../node/node.service";
import { CLogger, createLinkedHash, delay, freeBalanceAddressFromXpub } from "../util";

import { Transfer, TransferTypes, TransferStatus } from "./transfer.entity";
import { TransferRepository } from "./transfer.repository";

const logger = new CLogger("TransferService");

@Injectable()
export class TransferService {
  appId: string;

  constructor(
    private readonly nodeService: NodeService,
    private readonly configService: ConfigService,
    private readonly channelRepository: ChannelRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly transferRepository: TransferRepository,
  ) {}

  /**
   * Save pending transfer
   * @param data Data from PROPOSE_VIRTUAL event
   */
  async savePeerToPeerTransfer(data: ProposeVirtualMessage): Promise<Transfer> {
    const transfer = new Transfer();
    transfer.amount = data.data.params.initiatorDeposit;
    transfer.appInstanceId = data.data.appInstanceId;
    transfer.assetId = data.data.params.initiatorDepositTokenAddress;

    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(
      data.data.proposedByIdentifier,
    );
    transfer.senderChannel = senderChannel;

    const receiverChannel = await this.channelRepository.findByUserPublicIdentifier(
      data.data.params.proposedToIdentifier,
    );
    transfer.receiverChannel = receiverChannel;
    transfer.type = TransferTypes.PEER_TO_PEER;
    transfer.status = TransferStatus.PENDING;

    return await this.transferRepository.save(transfer);
  }

  async resolveLinkedTransfer(
    userPubId: string,
    paymentId: string,
    preImage: string,
    amount: BigNumber,
    assetId: string,
  ): Promise<ResolveLinkedTransferResponse> {
    logger.log(
      `Resolving linked transfer with userPubId: ${userPubId}, paymentId: ${paymentId}, ` +
        `preImage: ${preImage}, amount: ${amount}, assetId: ${assetId}`,
    );
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    if (!channel) {
      throw new Error(`No channel exists for userPubId ${userPubId}`);
    }

    // check that linked transfer app has been installed from sender
    const installedApps = await this.nodeService.getAppInstances();
    const linkedHash = createLinkedHash({ amount, assetId, paymentId, preImage });
    const senderApp = installedApps.find(
      (app: AppInstanceJson) =>
        (app.latestState as UnidirectionalLinkedTransferAppStateBigNumber).linkedHash ===
        linkedHash,
    );
    if (!senderApp) {
      throw new Error(`App with provided hash has not been installed.`);
    }

    const freeBal = await this.nodeService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );
    const preTransferBal =
      freeBal[freeBalanceAddressFromXpub(this.nodeService.cfNode.publicIdentifier)];

    const network = await this.configService.getEthNetwork();
    const appInfo = await this.appRegistryRepository.findByNameAndNetwork(
      SupportedApplications.UnidirectionalLinkedTransferApp,
      network.name as Network,
    );

    const initialState: UnidirectionalLinkedTransferAppStateBigNumber = {
      finalized: false,
      linkedHash,
      stage: UnidirectionalLinkedTransferAppStage.POST_FUND,
      transfers: [
        {
          amount,
          to: freeBalanceAddressFromXpub(userPubId),
        },
        {
          amount: Zero,
          to: freeBalanceAddressFromXpub(this.nodeService.cfNode.publicIdentifier),
        },
      ],
      turnNum: Zero,
    };

    await this.conditionalTransferAppInstalled(userPubId, amount, assetId, initialState, appInfo);

    // TODO: why do we have to do this?
    await this.waitForAppInstall();

    // finalize
    await this.finalizeAndUninstallApp(amount, assetId, paymentId, preImage);

    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.nodeService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );

    // pre - post = amount
    const diff = preTransferBal.sub(
      postTransferBal[freeBalanceAddressFromXpub(this.nodeService.cfNode.publicIdentifier)],
    );
    if (!diff.eq(amount)) {
      logger.warn(
        `It appears the difference of the free balance before and after
        uninstalling is not what we expected......`,
      );
      logger.warn(
        `preTransferBal: ${preTransferBal.toString()}, postTransferBalance: ${postTransferBal[
          freeBalanceAddressFromXpub(this.nodeService.cfNode.publicIdentifier)
        ].toString()}, expected ${amount.toString()}`,
      );
    } else if (
      postTransferBal[freeBalanceAddressFromXpub(this.nodeService.cfNode.publicIdentifier)].lte(
        preTransferBal,
      )
    ) {
      logger.warn("Free balance after transfer is lte free balance before transfer..");
    }

    // uninstall sender app
    // dont await so caller isnt blocked by this
    this.nodeService.uninstallApp(senderApp.identityHash);

    return {
      freeBalance: await this.nodeService.getFreeBalance(
        userPubId,
        channel.multisigAddress,
        assetId,
      ),
      paymentId,
    };
  }

  // creates a promise that is resolved once the app is installed
  // and rejected if the virtual application is rejected
  private conditionalTransferAppInstalled = async (
    userPubId: string,
    amount: BigNumber,
    assetId: string,
    initialState: ConditionalTransferInitialStateBigNumber,
    appInfo: AppRegistry,
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
      initiatorDeposit: amount,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: userPubId,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const res = await this.nodeService.proposeInstallApp(params);
    this.appId = res.appInstanceId;
    // set app instance id

    const installRes = await new Promise((res: () => any, rej: () => any): void => {
      boundReject = this.rejectInstallTransfer.bind(null, rej);
      boundResolve = this.resolveInstallTransfer.bind(null, res);
      this.nodeService.registerCfNodeListener(NodeTypes.EventName.INSTALL, boundResolve);
      this.nodeService.registerCfNodeListener(NodeTypes.EventName.REJECT_INSTALL, boundReject);
    });
    logger.log(`App was installed successfully!: ${JSON.stringify(installRes)}`);
    return (installRes as any).data.params.appInstanceId;
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
    await this.nodeService.takeAction(this.appId, action);

    // display final state of app
    const appInfo = await this.nodeService.getAppState(this.appId);

    // TODO: was getting an error here, printing this in case it happens again
    console.log("this.appId: ", this.appId);
    console.log("appInfo: ", appInfo);
    (appInfo.state as any).transfers[0][1] = (appInfo.state as any).transfers[0][1].toString();
    (appInfo.state as any).transfers[1][1] = (appInfo.state as any).transfers[1][1].toString();

    await this.nodeService.uninstallApp(this.appId);
    // TODO: cf does not emit uninstall virtual event on the node
    // that has called this function but ALSO does not immediately
    // uninstall the apps. This will be a problem when trying to
    // display balances...
    const openApps = await this.nodeService.getAppInstances();
    logger.log(`Open apps: ${openApps.length}`);
    logger.log(`AppIds: ${JSON.stringify(openApps.map((a: AppInstanceJson) => a.identityHash))}`);

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    await this.waitForAppUninstall();
  };

  // TODO: fix type of data
  private resolveInstallTransfer = (res: (value?: any) => void, data: any): any => {
    if (this.appId && this.appId !== data.data.params.appInstanceId) {
      logger.log(
        `Caught INSTALL event for different app ${JSON.stringify(data)}, expected ${this.appId}`,
      );
      return;
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

  private waitForAppInstall(): Promise<unknown> {
    if (!this.appId) {
      throw new Error(`appId not set, cannot wait for install`);
    }
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const getAppIds = async (): Promise<string[]> => {
          return (await this.nodeService.getAppInstances()).map(
            (a: AppInstanceJson) => a.identityHash,
          );
        };
        let retries = 0;
        while (!(await getAppIds()).includes(this.appId) && retries <= 30) {
          logger.log(
            `did not find app id ${this.appId} in the open apps... retry number ${retries}...`,
          );
          await delay(100);
          retries = retries + 1;
        }

        if (retries > 30) rej();

        res();
      },
    );
  }

  private waitForAppUninstall(): Promise<unknown> {
    if (!this.appId) {
      throw new Error(`appId not set, cannot wait for uninstall`);
    }
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const getAppIds = async (): Promise<string[]> => {
          return (await this.nodeService.getAppInstances()).map(
            (a: AppInstanceJson) => a.identityHash,
          );
        };
        let retries = 0;
        while ((await getAppIds()).indexOf(this.appId) !== -1 && retries <= 5) {
          logger.log("found app id in the open apps... retrying...");
          await delay(500);
          retries = retries + 1;
        }

        if (retries > 5) rej();

        res();
      },
    );
  }
}
