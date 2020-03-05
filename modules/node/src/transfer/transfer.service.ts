import { SimpleLinkedTransferApp } from "@connext/apps";

import {
  DepositConfirmationMessage,
  ResolveLinkedTransferResponse,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DepositFailedMessage,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleLinkedTransferAppState,
} from "@connext/types";
import { Injectable, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { HashZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";
import { xpubToAddress } from "../util";
import { AppInstanceJson } from "../util/cfCore";
import { Channel } from "../channel/channel.entity";

import { Transfer } from "./transfer.entity";
import { TransferRepository } from "./transfer.repository";
import { PeerToPeerTransfer, PeerToPeerTransferStatus } from "./peerToPeerTransfer.entity";
import { LinkedTransferRepository } from "./linkedTransfer.repository";
import { PeerToPeerTransferRepository } from "./peerToPeerTransfer.repository";
import { FastSignedTransferRepository } from "./fastSignedTransfer.repository";
import { FastSignedTransfer, FastSignedTransferStatus } from "./fastSignedTransfer.entity";
import { LinkedTransfer, LinkedTransferStatus } from "./linkedTransfer.entity";

@Injectable()
export class TransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly p2pTransferRepository: PeerToPeerTransferRepository,
    private readonly fastSignedTransferRespository: FastSignedTransferRepository,
    private readonly transferRepositiory: TransferRepository,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
  ) {
    this.log.setContext("TransferService");
  }

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
    encryptedPreImage: string,
    recipientPublicIdentifier?: string,
    meta?: object,
  ): Promise<LinkedTransfer> {
    const senderChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      senderPubId,
    );
    let receiverChannel: Channel;
    if (recipientPublicIdentifier) {
      receiverChannel = await this.channelRepository.findByUserPublicIdentifier(
        recipientPublicIdentifier,
      );
    }

    const transfer = new LinkedTransfer();
    transfer.senderAppInstanceId = appInstanceId;
    transfer.amount = amount;
    transfer.assetId = assetId;
    transfer.linkedHash = linkedHash;
    transfer.paymentId = paymentId;
    transfer.senderChannel = senderChannel;
    transfer.status = LinkedTransferStatus.PENDING;
    transfer.encryptedPreImage = encryptedPreImage;
    transfer.recipientPublicIdentifier = recipientPublicIdentifier;
    transfer.meta = meta;
    transfer.receiverChannel = receiverChannel;

    return await this.linkedTransferRepository.save(transfer);
  }

  async saveFastSignedTransfer(
    senderPubId: string,
    assetId: string,
    amount: BigNumber,
    appInstanceId: string,
    signer: string,
    paymentId: string,
    recipientPublicIdentifier?: string,
    meta?: object,
  ): Promise<FastSignedTransfer> {
    const senderChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      senderPubId,
    );
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      recipientPublicIdentifier,
    );

    const transfer = new FastSignedTransfer();
    transfer.senderAppInstanceId = appInstanceId;
    transfer.amount = amount;
    transfer.assetId = assetId;
    transfer.paymentId = paymentId;
    transfer.signer = signer;
    transfer.meta = meta;
    transfer.senderChannel = senderChannel;
    transfer.receiverChannel = receiverChannel;
    transfer.status = FastSignedTransferStatus.PENDING;

    return await this.fastSignedTransferRespository.save(transfer);
  }

  async getTransferByPaymentId(paymentId: string): Promise<Transfer | undefined> {
    return await this.transferRepositiory.findByPaymentId(paymentId);
  }

  async getLinkedTransferByPaymentId(paymentId: string): Promise<LinkedTransfer | undefined> {
    return await this.linkedTransferRepository.findByPaymentId(paymentId);
  }

  // @hunter -- this should be pulling from the transfer view right?
  async getAllLinkedTransfers(): Promise<LinkedTransfer[]> {
    return await this.linkedTransferRepository.findAll();
  }

  async resolveLinkedTransfer(
    userPubId: string,
    paymentId: string,
    linkedHash: string,
  ): Promise<ResolveLinkedTransferResponse> {
    this.log.debug(`resolveLinkedTransfer(${userPubId}, ${paymentId}, ${linkedHash})`);
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

    if (linkedHash !== transfer.linkedHash) {
      throw new Error(`No transfer exists for linkedHash ${linkedHash}`);
    }

    if (transfer.status !== LinkedTransferStatus.PENDING) {
      throw new Error(
        `Transfer with paymentId ${paymentId} cannot be redeemed with status: ${transfer.status}`,
      );
    }

    this.log.debug(`Found linked transfer in our database, attempting to install...`);

    const ethNetwork = await this.configService.getEthNetwork();
    const simpleLinkedTransferApp = await this.appRegistryRepository.findByNameAndNetwork(
      SimpleLinkedTransferApp,
      ethNetwork.chainId,
    );
    const installedApps = await this.cfCoreService.getAppInstances();
    const senderApp = installedApps.find(
      (app: AppInstanceJson) =>
        app.appInterface.addr === simpleLinkedTransferApp.appDefinitionAddress &&
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
          DEPOSIT_CONFIRMED_EVENT,
          async (msg: DepositConfirmationMessage) => {
            if (msg.from !== this.cfCoreService.cfCore.publicIdentifier) {
              // do not reject promise here, since theres a chance the event is
              // emitted for another user depositing into their channel
              this.log.debug(
                `Deposit event from field: ${msg.from}, did not match public identifier: ${this.cfCoreService.cfCore.publicIdentifier}`,
              );
              return;
            }
            if (msg.data.multisigAddress !== channel.multisigAddress) {
              // do not reject promise here, since theres a chance the event is
              // emitted for node collateralizing another users' channel
              this.log.debug(
                `Deposit event multisigAddress: ${msg.data.multisigAddress}, did not match channel multisig address: ${channel.multisigAddress}`,
              );
              return;
            }
            // make sure free balance is appropriate
            const fb = await this.cfCoreService.getFreeBalance(
              userPubId,
              channel.multisigAddress,
              assetId,
            );
            if (fb[freeBalanceAddr].lt(amountBN)) {
              return reject(
                `Free balance associated with ${freeBalanceAddr} is less than transfer amount: ${amountBN}`,
              );
            }
            resolve();
          },
        );
        this.cfCoreService.cfCore.on(DEPOSIT_FAILED_EVENT, (msg: DepositFailedMessage) => {
          return reject(JSON.stringify(msg, null, 2));
        });
        try {
          await this.channelService.rebalance(
            userPubId,
            assetId,
            RebalanceType.COLLATERALIZE,
            amountBN,
          );
        } catch (e) {
          return reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(userPubId, assetId, RebalanceType.COLLATERALIZE, amountBN);
    }

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
      preImage: HashZero,
    };

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      userPubId,
      initialState,
      transfer.amount,
      transfer.assetId,
      Zero,
      transfer.assetId,
      SimpleLinkedTransferApp,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appInstanceId) {
      throw new Error(`Could not install app on receiver side.`);
    }

    transfer.receiverAppInstanceId = receiverAppInstallRes.appInstanceId;
    transfer.paymentId = paymentId;
    transfer.recipientPublicIdentifier = userPubId;
    transfer.receiverChannel = channel;
    await this.linkedTransferRepository.save(transfer);

    return {
      appId: receiverAppInstallRes.appInstanceId,
      sender: transfer.senderChannel.userPublicIdentifier,
      meta: transfer.meta,
      paymentId,
    };
  }

  async reclaimLinkedTransferCollateralByAppInstanceIdIfExists(
    appInstanceId: string,
  ): Promise<void> {
    const transfer = await this.linkedTransferRepository.findByReceiverAppInstanceId(appInstanceId);
    if (!transfer || transfer.status !== LinkedTransferStatus.REDEEMED) {
      throw new Error(
        `Could not find transfer with REDEEMED status for receiver app id: ${appInstanceId}`,
      );
    }
    this.log.debug(`Found transfer: ${JSON.stringify(transfer)}`);
    await this.reclaimLinkedTransferCollateral(transfer);
  }

  async reclaimLinkedTransferCollateralByPaymentId(paymentId: string): Promise<void> {
    const transfer = await this.linkedTransferRepository.findByPaymentId(paymentId);
    if (!transfer || transfer.status !== LinkedTransferStatus.REDEEMED) {
      throw new Error(`Could not find transfer with REDEEMED status for paymentId: ${paymentId}`);
    }
    this.log.debug(`Found transfer: ${JSON.stringify(transfer)}`);
    await this.reclaimLinkedTransferCollateral(transfer);
  }

  private async reclaimLinkedTransferCollateral(transfer: LinkedTransfer): Promise<void> {
    if (transfer.status !== LinkedTransferStatus.REDEEMED) {
      throw new Error(
        `Transfer with id ${transfer.paymentId} has not been redeemed, status: ${transfer.status}`,
      );
    }

    const app = await this.cfCoreService.getAppInstanceDetails(transfer.senderAppInstanceId);
    // if action has been taken on the app, then there will be a preimage
    // in the latest state, and you just have to uninstall
    if ((app.latestState as SimpleLinkedTransferAppState).preImage !== transfer.preImage) {
      this.log.info(`Reclaiming linked transfer ${transfer.paymentId}`);
      this.log.debug(
        `Taking action with preImage ${transfer.preImage} and uninstalling app ${transfer.senderAppInstanceId} to reclaim collateral`,
      );
      await this.cfCoreService.takeAction(transfer.senderAppInstanceId, {
        preImage: transfer.preImage,
      });
    }
    this.log.debug(
      `Action has already been taken on app ${transfer.senderAppInstanceId}, uninstalling`,
    );
    this.log.debug(`Action taken, uninstalling app. ${Date.now()}`);

    // mark as reclaimed so the listener doesnt try to reclaim again
    await this.linkedTransferRepository.markAsReclaimed(transfer);
    await this.cfCoreService.uninstallApp(transfer.senderAppInstanceId);
    await this.messagingClient.emit(`transfer.${transfer.paymentId}.reclaimed`, {}).toPromise();
  }

  async getLinkedTransfersForReclaim(userPublicIdentifier: string): Promise<LinkedTransfer[]> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPubId ${userPublicIdentifier}`);
    }
    return await this.linkedTransferRepository.findReclaimable(channel);
  }

  async getPendingLinkedTransfers(userPublicIdentifier: string): Promise<LinkedTransfer[]> {
    await this.channelRepository.findByUserPublicIdentifierOrThrow(userPublicIdentifier);
    return await this.linkedTransferRepository.findPendingByRecipient(userPublicIdentifier);
  }

  async getTransfersByPublicIdentifier(userPublicIdentifier: string): Promise<Transfer[]> {
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPublicIdentifier);
    if (!channel) {
      throw new Error(`No channel exists for userPubId ${userPublicIdentifier}`);
    }
    return await this.transferRepositiory.findByPublicIdentifier(userPublicIdentifier);
  }
}
