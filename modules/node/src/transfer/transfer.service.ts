import {
  ConditionalTransferInitialStateBigNumber,
  ResolveLinkedTransferResponse,
  SupportedApplications,
  UnidirectionalLinkedTransferAppActionBigNumber,
  UnidirectionalLinkedTransferAppStage,
  UnidirectionalLinkedTransferAppStateBigNumber,
} from "@connext/types";
import { InstallMessage, RejectProposalMessage } from "@counterfactual/node";
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

import {
  LinkedTransfer,
  LinkedTransferStatus,
  PeerToPeerTransfer,
  PeerToPeerTransferStatus,
} from "./transfer.entity";
import { LinkedTransferRepository, PeerToPeerTransferRepository } from "./transfer.repository";

const logger = new CLogger("TransferService");

@Injectable()
export class TransferService {
  appId: string;

  constructor(
    private readonly nodeService: NodeService,
    private readonly configService: ConfigService,
    private readonly channelRepository: ChannelRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly p2pTransferRepository: PeerToPeerTransferRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
  ) {}

  async savePeerToPeerTransfer(
    senderPubId: string,
    receiverPubId: string,
    assetId: string,
    amount: BigNumber,
    appInstanceId: string,
  ): Promise<PeerToPeerTransfer> {
    const transfer = new PeerToPeerTransfer();
    transfer.amount = amount;
    transfer.appInstanceId = appInstanceId;
    transfer.assetId = assetId;

    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(senderPubId);
    transfer.senderChannel = senderChannel;

    const receiverChannel = await this.channelRepository.findByUserPublicIdentifier(receiverPubId);
    transfer.receiverChannel = receiverChannel;
    transfer.status = PeerToPeerTransferStatus.PENDING;

    return await this.p2pTransferRepository.save(transfer);
  }

  async saveLinkedTransfer(
    senderPubId: string,
    assetId: string,
    amount: BigNumber,
    appInstanceId: string,
    linkedHash: string,
  ): Promise<LinkedTransfer> {
    const transfer = new LinkedTransfer();
    transfer.appInstanceId = appInstanceId;
    transfer.amount = amount;
    transfer.assetId = assetId;
    transfer.linkedHash = linkedHash;

    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(senderPubId);
    transfer.senderChannel = senderChannel;

    transfer.status = LinkedTransferStatus.PENDING;

    return await this.linkedTransferRepository.save(transfer);
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

    const linkedHash = createLinkedHash({ amount, assetId, paymentId, preImage });

    // check that we have recorded this transfer in our db
    const transfer = await this.linkedTransferRepository.findByLinkedHash(linkedHash);
    if (!transfer) {
      throw new Error(`No transfer exists for linkedHash ${linkedHash}`);
    }
    if (transfer.status === LinkedTransferStatus.REDEEMED) {
      throw new Error(`Transfer with linkedHash ${linkedHash} has already been redeemed`);
    }

    // check that linked transfer app has been installed from sender
    const installedApps = await this.nodeService.getAppInstances();
    const senderApp = installedApps.find(
      (app: AppInstanceJson) =>
        (app.latestState as UnidirectionalLinkedTransferAppStateBigNumber).linkedHash ===
        linkedHash,
    );
    if (!senderApp) {
      throw new Error(`App with provided hash has not been installed: ${linkedHash}`);
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
          amount: Zero,
          to: freeBalanceAddressFromXpub(userPubId),
        },
        {
          amount,
          to: freeBalanceAddressFromXpub(this.nodeService.cfNode.publicIdentifier),
        },
      ],
      turnNum: Zero,
    };

    await this.conditionalTransferAppInstalled(userPubId, amount, assetId, initialState, appInfo);

    // TODO: why do we have to do this?
    await this.waitForAppInstall();

    // finalize
    await this.finalizeAndUninstallApp(this.appId, amount, assetId, paymentId, preImage);

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

    this.linkedTransferRepository.markAsRedeemed(transfer, channel);

    // uninstall sender app
    // dont await so caller isnt blocked by this
    // TODO: if sender is offline, this will fail
    this.finalizeAndUninstallApp(senderApp.identityHash, amount, assetId, paymentId, preImage);

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
    appInstanceId: string,
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
    await this.nodeService.takeAction(appInstanceId, action);

    // display final state of app
    const appInfo = await this.nodeService.getAppState(appInstanceId);

    // NOTE: was getting an error here, printing this in case it happens again
    console.log("appInstanceId: ", appInstanceId);
    console.log("appInfo: ", appInfo);
    // NOTE: sometimes transfers is a nested array, and sometimes its an
    // array of objects. super bizzarre, but is what would contribute to errors
    // with logging and casting.... :shrug:
    console.log("appInfo.transfers: ", (appInfo.state as any).transfers);

    await this.nodeService.uninstallApp(appInstanceId);
    const openApps = await this.nodeService.getAppInstances();
    logger.log(`Open apps: ${openApps.length}`);
    logger.log(`AppIds: ${JSON.stringify(openApps.map((a: AppInstanceJson) => a.identityHash))}`);

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    await this.waitForAppUninstall();
  };

  private resolveInstallTransfer = (res: (value?: any) => void, data: InstallMessage): any => {
    if (this.appId && this.appId !== data.data.params.appInstanceId) {
      logger.log(
        `Caught INSTALL event for different app ${JSON.stringify(data)}, expected ${this.appId}`,
      );
      return;
    }
    res(data);
    return data;
  };

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
