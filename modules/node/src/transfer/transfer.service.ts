import { DepositConfirmationMessage, NODE_EVENTS } from "@connext/cf-core";
import {
  DefaultApp,
  ResolveLinkedTransferResponse,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleTransferAppStateBigNumber,
  SupportedApplication,
  SupportedApplications,
} from "@connext/types";
import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { mkHash } from "../test";
import { CLogger, createLinkedHash, xpubToAddress } from "../util";
import { AppInstanceJson } from "../util/cfCore";

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
    @Inject(forwardRef(() => ChannelService))
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly channelRepository: ChannelRepository,
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

  // @hunter -- this should be pulling from the transfer view right?
  async getLinkedTransferByPaymentId(paymentId: string): Promise<LinkedTransfer | undefined> {
    return await this.linkedTransferRepository.findByPaymentId(paymentId);
  }

  // @hunter -- this should be pulling from the transfer view right?
  async getAllLinkedTransfers(): Promise<LinkedTransfer[]> {
    return await this.linkedTransferRepository.findAll();
  }

  async setRecipientAndEncryptedPreImageOnLinkedTransfer(
    senderPublicIdentifier: string,
    recipientPublicIdentifier: string,
    encryptedPreImage: string,
    linkedHash: string,
  ): Promise<LinkedTransfer> {
    logger.debug(
      `setRecipientAndEncryptedPreImageOnLinkedTransfer(${senderPublicIdentifier}, ${recipientPublicIdentifier}, ${encryptedPreImage}, ${linkedHash}`,
    );

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
    logger.debug(`resolveLinkedTransfer(${userPubId}, ${paymentId}, ${preImage})`);
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
    const installedApps = await this.cfCoreService.getAppInstances(channel.multisigAddress);
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
          "DEPOSIT_CONFIRMED_EVENT",
          async (msg: DepositConfirmationMessage) => {
            if (msg.from !== this.cfCoreService.cfCore.publicIdentifier) {
              return;
            }
            if (msg.data.multisigAddress !== channel.multisigAddress) {
              return;
            }
            // make sure free balance is appropriate
            const fb = await this.cfCoreService.getFreeBalance(
              userPubId,
              channel.multisigAddress,
              assetId,
            );
            if (fb[freeBalanceAddr].lt(amountBN)) {
              // wait for resolve
              return;
            }
            resolve();
          },
        );
        try {
          await this.channelService.requestCollateral(userPubId, assetId, amountBN);
        } catch (e) {
          reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.requestCollateral(userPubId, assetId, amountBN);
    }

    const preTransferBal = freeBal[this.cfCoreService.cfCore.freeBalanceAddress];

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

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      userPubId,
      initialState,
      transfer.amount,
      transfer.assetId,
      Zero,
      transfer.assetId,
      SupportedApplications.SimpleLinkedTransferApp as SupportedApplication,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appInstanceId) {
      throw new Error(`Could not install app on receiver side.`);
    }

    // add preimage to database to allow unlock from a listener
    transfer.receiverAppInstanceId = receiverAppInstallRes.appInstanceId;
    transfer.preImage = mkHash("0x0");
    transfer.paymentId = paymentId;
    await this.linkedTransferRepository.save(transfer);

    await this.cfCoreService.takeAction(receiverAppInstallRes.appInstanceId, { preImage });
    await this.cfCoreService.uninstallApp(receiverAppInstallRes.appInstanceId);

    // pre - post = amount
    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );

    const diff = preTransferBal.sub(postTransferBal[this.cfCoreService.cfCore.freeBalanceAddress]);

    if (!diff.eq(amountBN)) {
      logger.warn(`Got an unexpected difference of free balances before and after uninstalling`);
      logger.warn(
        `preTransferBal: ${preTransferBal.toString()}, postTransferBalance: ${postTransferBal[
          this.cfCoreService.cfCore.freeBalanceAddress
        ].toString()}, expected ${amount}`,
      );
    } else {
      logger.log(`Balances look okay, consider removing check in transfer.service line 289`);
    }

    this.linkedTransferRepository.markAsRedeemed(transfer, channel);

    // uninstall sender app
    // dont await so caller isnt blocked by this
    // TODO: if sender is offline, this will fail
    this.cfCoreService
      .takeAction(senderApp.identityHash, { preImage })
      .then(() => this.cfCoreService.uninstallApp(senderApp.identityHash))
      .then(() => this.linkedTransferRepository.markAsReclaimed(transfer))
      .catch((e: any): void => logger.error(e.message, e.stack));

    return {
      freeBalance: await this.cfCoreService.getFreeBalance(
        userPubId,
        channel.multisigAddress,
        assetId,
      ),
      paymentId,
    };
  }

  async sendTransferToClient(
    userPubId: string,
    amount: BigNumber,
    assetId: string,
  ): Promise<string> {
    logger.debug(`sendTransferToClient(${userPubId}, ${amount}, ${assetId}`);
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    if (!channel) {
      throw new Error(`No channel exists for userPubId ${userPubId}`);
    }

    const initialState: SimpleTransferAppStateBigNumber = {
      coinTransfers: [
        {
          amount,
          to: this.cfCoreService.cfCore.freeBalanceAddress,
        },
        {
          amount: Zero,
          to: xpubToAddress(userPubId),
        },
      ],
    };

    const res = await this.cfCoreService.proposeAndWaitForInstallApp(
      userPubId,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      SupportedApplications.SimpleTransferApp as SupportedApplication,
    );

    if (!res || !res.appInstanceId) {
      throw new Error(`App was not successfully installed.`);
    }

    return res.appInstanceId;
  }

  async getPendingTransfers(userPublicIdentifier: string): Promise<LinkedTransfer[]> {
    return await this.linkedTransferRepository.findPendingByRecipient(userPublicIdentifier);
  }

  async getTransfersByPublicIdentifier(userPublicIdentifier: string): Promise<Transfer[]> {
    return await this.transferRepositiory.findByPublicIdentifier(userPublicIdentifier);
  }
}
