import {
  LinkedTransferStatus,
  NodeResponses,
  SimpleLinkedTransferAppName,
  SimpleLinkedTransferAppState,
  toBN,
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

import { AppType, AppInstance } from "../appInstance/appInstance.entity";

const appStatusesToLinkedTransferStatus = (
  senderAppType: AppType,
  receiverAppType?: AppType,
): LinkedTransferStatus | undefined => {
  if (!senderAppType) {
    return undefined;
  }

  if (!receiverAppType) {
    return LinkedTransferStatus.PENDING;
  }

  if (senderAppType === AppType.UNINSTALLED || receiverAppType === AppType.UNINSTALLED) {
    return LinkedTransferStatus.COMPLETED;
  }

  if (senderAppType === AppType.REJECTED || receiverAppType === AppType.REJECTED) {
    return LinkedTransferStatus.FAILED;
  }

  if (senderAppType === AppType.INSTANCE && receiverAppType === AppType.INSTANCE) {
    return LinkedTransferStatus.PENDING;
  }

  throw new Error(
    `Unable to determine linked transfer status from senderAppType (${senderAppType}) and receiverAppType (${receiverAppType})`,
  );
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
  ): Promise<NodeResponses.ResolveLinkedTransfer> {
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

    const latestState = senderApp.latestState as SimpleLinkedTransferAppState;
    const amount = toBN(latestState.amount);
    const { assetId, linkedHash } = latestState;
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
      const depositReceipt = await this.channelService.rebalance(
        userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amountBN,
      );
      if (!depositReceipt) {
        throw new Error(`Could not obtain sufficient collateral for receiver channel when resolving linked payment ${paymentId}`);
      }
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(
        userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        amountBN,
      );
    }

    const initialState: SimpleLinkedTransferAppState = {
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
      SimpleLinkedTransferAppName,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appIdentityHash) {
      throw new Error(`Could not install app on receiver side.`);
    }

    const returnRes: NodeResponses.ResolveLinkedTransfer = {
      appIdentityHash: receiverAppInstallRes.appIdentityHash,
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
    const status = appStatusesToLinkedTransferStatus(
      senderApp ? senderApp.type : undefined,
      receiverApp ? receiverApp.type : undefined,
    );

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
    const transfersFromNodeToUser =
      await this.appInstanceRepository.findActiveLinkedTransferAppsToRecipient(
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
        const preImage: string = senderApp.latestState["preImage"];
        if (preImage === HashZero) {
          // no action has been taken, but is not uninstalled
          await this.cfCoreService.takeAction(senderApp.identityHash, {
            preImage,
          });
        }
        await this.cfCoreService.uninstallApp(senderApp.identityHash);
        unlockedAppIds.push(senderApp.identityHash);
        this.log.log(`Unlocked transfer from app ${senderApp.identityHash}`);
      }
    }
    return unlockedAppIds;
  }
}
