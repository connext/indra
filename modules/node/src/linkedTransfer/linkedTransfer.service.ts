import {
  DepositConfirmationMessage,
  ResolveLinkedTransferResponseBigNumber,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DepositFailedMessage,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferApp,
  LinkedTransferStatus,
  SimpleLinkedTransferAppAction,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { xkeyKthAddress } from "../util";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

import { convertLinkedTransferAppState } from "@connext/apps";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";

const appStatusesToLinkedTransferStatus = (
  senderAppType: AppType,
  receiverAppType?: AppType,
): LinkedTransferStatus | undefined => {
  if (!senderAppType) {
    return undefined;
  } else if (senderAppType === AppType.UNINSTALLED) {
    // if sender app is uninstalled, transfer has been unlocked by node
    return LinkedTransferStatus.UNLOCKED;
  } else if (!receiverAppType) {
    return LinkedTransferStatus.PENDING;
  } else if (receiverAppType === AppType.UNINSTALLED) {
    // if receiver app is uninstalled, sender may have been offline when receiver redeemed
    return LinkedTransferStatus.REDEEMED;
  } else if (senderAppType === AppType.REJECTED || receiverAppType === AppType.REJECTED) {
    return LinkedTransferStatus.FAILED;
  } else {
    throw new Error(`Unable to determine status`);
  }
};

@Injectable()
export class LinkedTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("LinkedTransferService");
  }

  async resolveLinkedTransfer(
    userPublicIdentifier: string,
    paymentId: string,
  ): Promise<ResolveLinkedTransferResponseBigNumber> {
    this.log.debug(`resolveLinkedTransfer(${userPublicIdentifier}, ${paymentId})`);
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userPublicIdentifier,
    );

    // TODO: handle offline case
    // node is receiver in sender app
    const senderApp = await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.freeBalanceAddress,
    );
    if (!senderApp) {
      throw new Error(`Sender app is not installed for paymentId ${paymentId}`);
    }

    const { assetId, amount, linkedHash } = convertLinkedTransferAppState(
      "bignumber",
      senderApp.latestState as SimpleLinkedTransferAppState,
    );
    const amountBN = bigNumberify(amount);

    this.log.debug(`Found linked transfer in our database, attempting to install...`);

    const freeBalanceAddr = this.cfCoreService.cfCore.freeBalanceAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      userPublicIdentifier,
      receiverChannel.multisigAddress,
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
            if (msg.data.multisigAddress !== receiverChannel.multisigAddress) {
              // do not reject promise here, since theres a chance the event is
              // emitted for node collateralizing another users' channel
              this.log.debug(
                `Deposit event multisigAddress: ${msg.data.multisigAddress}, did not match channel multisig address: ${receiverChannel.multisigAddress}`,
              );
              return;
            }
            // make sure free balance is appropriate
            const fb = await this.cfCoreService.getFreeBalance(
              userPublicIdentifier,
              receiverChannel.multisigAddress,
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
            userPublicIdentifier,
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
      this.channelService.rebalance(
        userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amountBN,
      );
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
          to: xkeyKthAddress(userPublicIdentifier),
        },
      ],
      linkedHash,
      paymentId,
      preImage: HashZero,
    };

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      receiverChannel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      SimpleLinkedTransferApp,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appInstanceId) {
      throw new Error(`Could not install app on receiver side.`);
    }

    const returnRes: ResolveLinkedTransferResponseBigNumber = {
      appId: receiverAppInstallRes.appInstanceId,
      sender: senderApp.channel.userPublicIdentifier,
      meta: senderApp.meta,
      paymentId,
      amount,
      assetId,
    };
    return returnRes;
  }

  async findSenderAndReceiverAppsWithStatus(
    paymentId: string,
  ): Promise<
    { senderApp: AppInstance; receiverApp: AppInstance; status: LinkedTransferStatus } | undefined
  > {
    const senderApp = await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.freeBalanceAddress,
    );
    const receiverApp = await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.freeBalanceAddress,
    );
    // if sender app is uninstalled, transfer has been unlocked by node
    const status = appStatusesToLinkedTransferStatus(senderApp?.type, receiverApp?.type);

    return { senderApp, receiverApp, status };
  }

  // reclaimable transfer:
  // sender app is installed with meta containing recipient information
  // preImage is HashZero
  // receiver app has never been installed
  //
  // eg:
  // sender installs app, goes offline
  // receiver redeems, app is installed and uninstalled
  // if we don't check for uninstalled receiver app, receiver can keep redeeming
  async getLinkedTransfersForRedeem(userPublicIdentifier: string): Promise<AppInstance[]> {
    const transfersFromNodeToUser = await this.appInstanceRepository.findActiveLinkedTransferAppsToRecipient(
      userPublicIdentifier,
      this.cfCoreService.cfCore.freeBalanceAddress,
    );
    const existingReceiverApps = (
      await Promise.all(
        transfersFromNodeToUser.map(
          async transfer =>
            await this.appInstanceRepository.findLinkedTransferAppByPaymentIdAndSender(
              transfer.latestState["paymentId"],
              this.cfCoreService.cfCore.freeBalanceAddress,
            ),
        ),
      )
    )
      // remove nulls
      .filter(transfer => !!transfer);
    const alreadyRedeemedPaymentIds = existingReceiverApps.map(app => app.latestState["paymentId"]);
    const redeemableTransfers = transfersFromNodeToUser.filter(
      transfer => !alreadyRedeemedPaymentIds.includes(transfer.latestState["paymentId"]),
    );
    return redeemableTransfers;
  }

  // unlockable transfer:
  // sender app is installed with node as recipient
  // preImage is HashZero
  // receiver app with same paymentId is uninstalled
  // preImage on receiver app is used to unlock sender transfer
  //
  // eg:
  // sender installs app, goes offline
  // receiver redeems, app is installed and uninstalled
  // sender comes back online, node can unlock transfer
  async unlockLinkedTransfersFromUser(userPublicIdentifier: string): Promise<string[]> {
    // eslint-disable-next-line max-len
    const transfersFromUserToNode = await this.appInstanceRepository.findActiveLinkedTransferAppsFromSenderToNode(
      xkeyKthAddress(userPublicIdentifier),
      this.cfCoreService.cfCore.freeBalanceAddress,
    );
    const receiverRedeemed = await Promise.all(
      transfersFromUserToNode.map(async transfer =>
        this.appInstanceRepository.findRedeemedLinkedTransferAppByPaymentIdFromNode(
          transfer.latestState["paymentId"],
          this.cfCoreService.cfCore.freeBalanceAddress,
        ),
      ),
    );
    const unlockedAppIds: string[] = [];
    // map sender and receiver transfers
    for (const { senderApp, receiverApp } of transfersFromUserToNode.map((senderApp, index) => {
      return { senderApp, receiverApp: receiverRedeemed[index] };
    })) {
      // if receiverApp exists, sender can be unlocked
      if (receiverApp) {
        this.log.log(`Found transfer to unlock, paymentId ${senderApp.latestState["paymentId"]}`);
        await this.cfCoreService.takeAction(senderApp.identityHash, {
          preImage: receiverApp.latestState["preImage"],
        } as SimpleLinkedTransferAppAction);
        await this.cfCoreService.uninstallApp(senderApp.identityHash);
        unlockedAppIds.push(senderApp.identityHash);
        this.log.log(`Unlocked transfer from app ${senderApp.identityHash}`);
      }
    }
    return unlockedAppIds;
  }
}
