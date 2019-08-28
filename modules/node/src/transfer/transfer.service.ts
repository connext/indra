import {
  ConditionalTransferInitialStateBigNumber,
  ResolveLinkedTransferResponse,
  SupportedApplications,
  UnidirectionalLinkedTransferAppActionBigNumber,
  UnidirectionalLinkedTransferAppStage,
  UnidirectionalLinkedTransferAppStateBigNumber,
} from "@connext/types";
import { AppInstanceJson, Node as NodeTypes } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
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
    private readonly channelService: ChannelService,
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
    transfer.senderAppInstanceId = appInstanceId;
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

    await this.channelService.requestCollateral(userPubId, assetId, amount);

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

    const receiverApp = await this.installLinkedTransferApp(
      userPubId,
      initialState,
      preImage,
      paymentId,
      transfer,
      appInfo,
    );

    // TODO: why do we have to do this?
    await this.waitForAppInstall(receiverApp.receiverAppInstanceId);

    await this.finalizeAndUninstallTransferApp(receiverApp.receiverAppInstanceId, transfer);

    // pre - post = amount
    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.nodeService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );

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
    this.finalizeAndUninstallTransferApp(senderApp.identityHash, transfer);

    return {
      freeBalance: await this.nodeService.getFreeBalance(
        userPubId,
        channel.multisigAddress,
        assetId,
      ),
      paymentId,
    };
  }

  async installLinkedTransferApp(
    userPubId: string,
    initialState: ConditionalTransferInitialStateBigNumber,
    preImage: string,
    paymentId: string,
    transfer: LinkedTransfer,
    appInfo: AppRegistry,
  ): Promise<LinkedTransfer> {
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
      initiatorDeposit: transfer.amount,
      initiatorDepositTokenAddress: transfer.assetId,
      outcomeType,
      proposedToIdentifier: userPubId,
      responderDeposit: Zero,
      responderDepositTokenAddress: transfer.assetId,
      timeout: Zero,
    };

    const res = await this.nodeService.proposeInstallApp(params);

    // add preimage to database to allow unlock from a listener
    transfer.receiverAppInstanceId = res.appInstanceId;
    transfer.preImage = preImage;
    transfer.paymentId = paymentId;
    return await this.linkedTransferRepository.save(transfer);

    // app will be finalized and uninstalled by the install listener in listener service
  }

  async finalizeAndUninstallTransferApp(
    appInstanceId: string,
    transfer: LinkedTransfer,
  ): Promise<void> {
    const { amount, assetId, paymentId, preImage } = transfer;
    // display initial state of app
    const preActionApp = await this.nodeService.getAppState(appInstanceId);

    // NOTE: was getting an error here, printing this in case it happens again
    console.log("appInstanceId: ", appInstanceId);
    console.log("preAction appInfo: ", JSON.stringify(preActionApp, null, 2));
    console.log(
      "preAction appInfo.transfers: ",
      JSON.stringify((preActionApp.state as any).transfers, null, 2),
    );
    const action: UnidirectionalLinkedTransferAppActionBigNumber = {
      amount,
      assetId,
      paymentId,
      preImage,
    };
    await this.nodeService.takeAction(appInstanceId, action);

    await this.waitForFinalize(appInstanceId);

    // display final state of app
    const appInfo = await this.nodeService.getAppState(appInstanceId);

    // NOTE: was getting an error here, printing this in case it happens again
    console.log("postAction appInfo: ", JSON.stringify(appInfo, null, 2));
    // NOTE: sometimes transfers is a nested array, and sometimes its an
    // array of objects. super bizzarre, but is what would contribute to errors
    // with logging and casting.... :shrug:
    console.log(
      "postAction appInfo.transfers: ",
      JSON.stringify((appInfo.state as any).transfers, null, 2),
    );

    await this.nodeService.uninstallApp(appInstanceId);
    const openApps = await this.nodeService.getAppInstances();
    logger.log(`Open apps: ${openApps.length}`);
    logger.log(`AppIds: ${JSON.stringify(openApps.map((a: AppInstanceJson) => a.identityHash))}`);

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    await this.waitForAppUninstall(appInstanceId);
  }

  async waitForAppInstall(appInstanceId: string): Promise<unknown> {
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const getAppIds = async (): Promise<string[]> => {
          return (await this.nodeService.getAppInstances()).map(
            (a: AppInstanceJson) => a.identityHash,
          );
        };
        let retries = 0;
        while (!(await getAppIds()).includes(appInstanceId) && retries <= 30) {
          logger.log(
            `did not find app id ${appInstanceId} in the open apps... retry number ${retries}...`,
          );
          await delay(200);
          retries = retries + 1;
        }

        if (retries > 30) {
          rej();
          return;
        }
        logger.log(
          `found app id ${appInstanceId} in the open apps after retry number ${retries}...`,
        );
        res(this.appId);
      },
    );
  }

  private waitForFinalize(appInstanceId: string): Promise<unknown> {
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const isFinalized = async (): Promise<boolean> => {
          const appInfo = await this.nodeService.getAppState(appInstanceId);
          const appState = appInfo.state as UnidirectionalLinkedTransferAppStateBigNumber;
          return appState.finalized;
        };
        let retries = 0;
        while (!(await isFinalized()) && retries <= 30) {
          logger.log(`transfer has not been finalized... retry number ${retries}...`);
          await delay(200);
          retries = retries + 1;
        }

        if (retries > 30) rej();
        logger.log(`transfer finalized after retry number ${retries}`);
        res(this.appId);
      },
    );
  }

  private waitForAppUninstall(appInstanceId: string): Promise<unknown> {
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const getAppIds = async (): Promise<string[]> => {
          return (await this.nodeService.getAppInstances()).map(
            (a: AppInstanceJson) => a.identityHash,
          );
        };
        let retries = 0;
        while ((await getAppIds()).indexOf(appInstanceId) !== -1 && retries <= 5) {
          logger.log("found app id in the open apps... retrying...");
          await delay(500);
          retries = retries + 1;
        }

        if (retries > 5) {
          rej();
          return;
        }
        logger.log(`${appInstanceId} no longer in the open apps after retry number ${retries}...`);
        res();
      },
    );
  }
}
