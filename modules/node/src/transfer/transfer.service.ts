import { DepositConfirmationMessage, NODE_EVENTS } from "@connext/cf-core";
import { NatsMessagingService } from "@connext/messaging";
import {
  ResolveLinkedTransferResponse,
  SimpleLinkedTransferAppStateBigNumber,
  SupportedApplications,
} from "@connext/types";
import { Inject, Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService, DefaultApp } from "../config/config.service";
import { MessagingProviderId, Network } from "../constants";
import { mkHash } from "../test";
import {
  CLogger,
  createLinkedHash,
  InstallMessage,
  RejectProposalMessage,
  replaceBN,
  xpubToAddress,
} from "../util";
import { AppInstanceJson, CFCoreTypes } from "../util/cfCore";

import {
  LinkedTransfer,
  LinkedTransferStatus,
  PeerToPeerTransfer,
  PeerToPeerTransferStatus,
  Transfer,
} from "./transfer.entity";
import {
  LinkedTransferRepository,
  PeerToPeerTransferRepository,
  TransferRepository,
} from "./transfer.repository";

const logger = new CLogger("TransferService");

@Injectable()
export class TransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    @Inject(MessagingProviderId) private readonly messagingProvider: NatsMessagingService,
    private readonly channelRepository: ChannelRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly p2pTransferRepository: PeerToPeerTransferRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly transferRepositiory: TransferRepository,
  ) {}

  async savePeerToPeerTransfer(
    senderPubId: string,
    receiverPubId: string,
    assetId: string,
    amount: BigNumber,
    appInstanceId: string,
    meta?: object,
  ): Promise<PeerToPeerTransfer> {
    const transfer = new PeerToPeerTransfer();
    transfer.amount = amount;
    transfer.appInstanceId = appInstanceId;
    transfer.assetId = assetId;
    transfer.meta = meta;

    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(senderPubId);
    if (!senderChannel) {
      throw new Error(`Sender channel does not exist for ${senderPubId}`);
    }
    transfer.senderChannel = senderChannel;

    const receiverChannel = await this.channelRepository.findByUserPublicIdentifier(receiverPubId);
    if (!receiverChannel) {
      throw new Error(`Receiver channel does not exist for ${receiverPubId}`);
    }
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
    paymentId: string,
    meta?: object,
  ): Promise<LinkedTransfer> {
    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(senderPubId);
    if (!senderChannel) {
      throw new Error(`Sender channel does not exist for ${senderPubId}`);
    }

    const transfer = new LinkedTransfer();
    transfer.senderAppInstanceId = appInstanceId;
    transfer.amount = amount;
    transfer.assetId = assetId;
    transfer.linkedHash = linkedHash;
    transfer.paymentId = paymentId;
    transfer.senderChannel = senderChannel;
    transfer.status = LinkedTransferStatus.PENDING;
    transfer.meta = meta;

    return await this.linkedTransferRepository.save(transfer);
  }

  async fetchLinkedTransfer(paymentId: string): Promise<any> {
    return await this.linkedTransferRepository.findByPaymentId(paymentId);
  }

  async setRecipientAndEncryptedPreImageOnLinkedTransfer(
    senderPublicIdentifier: string,
    recipientPublicIdentifier: string,
    encryptedPreImage: string,
    linkedHash: string,
  ): Promise<LinkedTransfer> {
    logger.debug(`Setting recipient ${recipientPublicIdentifier} on linkedHash ${linkedHash}`);

    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(
      senderPublicIdentifier,
    );
    if (!senderChannel) {
      throw new Error(`No channel exists for senderPublicIdentifier ${senderPublicIdentifier}`);
    }

    const recipientChannel = await this.channelRepository.findByUserPublicIdentifier(
      recipientPublicIdentifier,
    );
    if (!recipientChannel) {
      throw new Error(
        `No channel exists for recipientPublicIdentifier ${recipientPublicIdentifier}`,
      );
    }

    // check that we have recorded this transfer in our db
    const transfer = await this.linkedTransferRepository.findByLinkedHash(linkedHash);
    if (!transfer) {
      throw new Error(`No transfer exists for linkedHash ${linkedHash}`);
    }

    if (senderPublicIdentifier !== transfer.senderChannel.userPublicIdentifier) {
      throw new Error(`Can only modify transfer that you sent`);
    }

    return await this.linkedTransferRepository.addRecipientPublicIdentifierAndEncryptedPreImage(
      transfer,
      recipientPublicIdentifier,
      encryptedPreImage,
    );
  }

  async resolveLinkedTransfer(
    userPubId: string,
    paymentId: string,
    preImage: string,
  ): Promise<ResolveLinkedTransferResponse> {
    logger.debug(
      `Resolving linked transfer with userPubId: ${userPubId}, ` +
        `paymentId: ${paymentId}, preImage: ${preImage}`,
    );
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    if (!channel) {
      throw new Error(`No channel exists for userPubId ${userPubId}`);
    }

    // check that we have recorded this transfer in our db
    const transfer = await this.linkedTransferRepository.findByPaymentId(paymentId);
    if (!transfer) {
      throw new Error(`No transfer exists for paymentId ${paymentId}`);
    }

    const { assetId, amount } = transfer;
    const amountBN = bigNumberify(amount);

    const linkedHash = createLinkedHash(amount, assetId, paymentId, preImage);
    if (linkedHash !== transfer.linkedHash) {
      throw new Error(`No transfer exists for linkedHash ${linkedHash}`);
    }
    if (transfer.status === LinkedTransferStatus.REDEEMED) {
      throw new Error(`Transfer with linkedHash ${linkedHash} has already been redeemed`);
    }

    logger.debug(`Found linked transfer in our database, attempting to resolve...`);

    // check that linked transfer app has been installed from sender
    const defaultApp = (await this.configService.getDefaultApps()).find(
      (app: DefaultApp) => app.name === SupportedApplications.SimpleLinkedTransferApp,
    );
    const installedApps = await this.cfCoreService.getAppInstances();
    const senderApp = installedApps.find(
      (app: AppInstanceJson) =>
        app.appInterface.addr === defaultApp!.appDefinitionAddress &&
        (app.latestState as SimpleLinkedTransferAppStateBigNumber).linkedHash === linkedHash,
    );

    if (!senderApp) {
      throw new Error(`App with provided hash has not been installed: ${linkedHash}`);
    }

    const freeBalanceAddr = this.cfCoreService.cfCore.freeBalanceAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );
    if (freeBal[freeBalanceAddr].lt(amountBN)) {
      // request collateral and wait for deposit to come through
      // TODO: expose remove listener
      await new Promise(async (resolve, reject) => {
        this.cfCoreService.cfCore.on(
          NODE_EVENTS.DEPOSIT_CONFIRMED,
          (msg: DepositConfirmationMessage) => {
            if (msg.from !== this.cfCoreService.cfCore.publicIdentifier) {
              return;
            }
            if (msg.data.multisigAddress !== channel.multisigAddress) {
              return;
            }
            resolve();
          },
        );
        try {
          const result = await this.channelService.requestCollateral(userPubId, assetId, amountBN);
          if (!result) {
            // no collateral request sent
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.requestCollateral(userPubId, assetId, amountBN);
    }

    const preTransferBal = freeBal[xpubToAddress(this.cfCoreService.cfCore.publicIdentifier)];

    const network = await this.configService.getEthNetwork();
    const appInfo = await this.appRegistryRepository.findByNameAndNetwork(
      SupportedApplications.SimpleLinkedTransferApp,
      network.name as Network,
    );

    const initialState: SimpleLinkedTransferAppStateBigNumber = {
      amount: amountBN,
      assetId,
      coinTransfers: [
        {
          amount: amountBN,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: xpubToAddress(userPubId),
        },
      ],
      linkedHash,
      paymentId,
      preImage: mkHash("0x0"),
    };

    const receiverApp = await this.installLinkedTransferApp(
      userPubId,
      initialState,
      mkHash("0x0"),
      paymentId,
      transfer,
      appInfo,
    );

    await this.takeActionAndUninstallLink(receiverApp.receiverAppInstanceId, preImage);

    // pre - post = amount
    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );

    const diff = preTransferBal.sub(
      postTransferBal[xpubToAddress(this.cfCoreService.cfCore.publicIdentifier)],
    );

    if (!diff.eq(amountBN)) {
      logger.warn(`Got an unexpected difference of free balances before and after uninstalling`);
      logger.warn(
        `preTransferBal: ${preTransferBal.toString()}, postTransferBalance: ${postTransferBal[
          xpubToAddress(this.cfCoreService.cfCore.publicIdentifier)
        ].toString()}, expected ${amount}`,
      );
    }

    this.linkedTransferRepository.markAsRedeemed(transfer, channel);

    // uninstall sender app
    // dont await so caller isnt blocked by this
    // TODO: if sender is offline, this will fail
    this.takeActionAndUninstallLink(senderApp.identityHash, preImage)
      .then(() => {
        this.linkedTransferRepository.markAsReclaimed(transfer);
      })
      .catch(logger.error);

    return {
      freeBalance: await this.cfCoreService.getFreeBalance(
        userPubId,
        channel.multisigAddress,
        assetId,
      ),
      paymentId,
    };
  }

  async getPendingTransfers(userPublicIdentifier: string): Promise<LinkedTransfer[]> {
    return await this.linkedTransferRepository.findPendingByRecipient(userPublicIdentifier);
  }

  async getTransfersByPublicIdentifier(userPublicIdentifier: string): Promise<Transfer[]> {
    return await this.transferRepositiory.findByPublicIdentifier(userPublicIdentifier);
  }

  private async takeActionAndUninstallLink(appId: string, preImage: string): Promise<void> {
    try {
      logger.log(`Taking action on app ${appId} at ${Date.now()}`);
      await this.cfCoreService.takeAction(appId, { preImage });
      logger.log(`Uninstalling app ${appId} at ${Date.now()}`);
      await this.cfCoreService.uninstallApp(appId);
    } catch (e) {
      throw new Error(`takeActionAndUninstallLink: ${e}`);
    }
  }

  private async installLinkedTransferApp(
    userPubId: string,
    initialState: SimpleLinkedTransferAppStateBigNumber,
    preImage: string,
    paymentId: string,
    transfer: LinkedTransfer,
    appInfo: AppRegistry,
  ): Promise<LinkedTransfer | undefined> {
    let boundResolve: (value?: any) => void;
    let boundReject: (reason?: any) => void;

    // note: intermediary is added in connext.ts as well
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
    } = appInfo;
    const params: CFCoreTypes.ProposeInstallParams = {
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

    const proposeRes = await this.cfCoreService.proposeInstallApp(params);

    // add preimage to database to allow unlock from a listener
    transfer.receiverAppInstanceId = proposeRes.appInstanceId;
    transfer.preImage = preImage;
    transfer.paymentId = paymentId;

    try {
      await new Promise((res: () => any, rej: (msg: string) => any): void => {
        boundResolve = this.resolveInstallTransfer.bind(null, res);
        boundReject = this.rejectInstallTransfer.bind(null, rej);
        this.messagingProvider.subscribe(
          `indra.client.${userPubId}.install.${proposeRes.appInstanceId}`,
          boundResolve,
        );
        this.cfCoreService.cfCore.on(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
      });
      logger.log(`App was installed successfully!: ${JSON.stringify(proposeRes)}`);
      return await this.linkedTransferRepository.save(transfer);
    } catch (e) {
      logger.error(`Error installing app: ${e.toString()}`);
      return undefined;
    } finally {
      this.cleanupInstallListeners(boundReject, proposeRes.appInstanceId, userPubId);
    }
  }

  private resolveInstallTransfer = (
    res: (value?: unknown) => void,
    message: InstallMessage,
  ): InstallMessage => {
    res(message);
    return message;
  };

  private rejectInstallTransfer = (
    rej: (reason?: string) => void,
    msg: RejectProposalMessage,
  ): any => {
    return rej(`Install failed. Event data: ${JSON.stringify(msg, replaceBN, 2)}`);
  };

  private cleanupInstallListeners = (boundReject: any, appId: string, userPubId: string): void => {
    this.messagingProvider.unsubscribe(`indra.client.${userPubId}.install.${appId}`);
    this.cfCoreService.cfCore.off(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
  };
}
