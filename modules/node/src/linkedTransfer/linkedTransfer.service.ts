import { LinkedTransferStatus, SimpleLinkedTransferAppName } from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { constants } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { LoggerService } from "../logger/logger.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { AppRegistryService } from "../appRegistry/appRegistry.service";

const { HashZero } = constants;

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

  if (
    (senderAppType === AppType.INSTANCE || senderAppType === AppType.PROPOSAL) &&
    (receiverAppType === AppType.INSTANCE || receiverAppType === AppType.PROPOSAL)
  ) {
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
    private readonly log: LoggerService,
    private readonly appRegistryService: AppRegistryService,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("LinkedTransferService");
  }

  async findSenderAndReceiverAppsWithStatus(
    paymentId: string,
  ): Promise<
    { senderApp: AppInstance; receiverApp: AppInstance; status: LinkedTransferStatus } | undefined
  > {
    this.log.info(`findSenderAndReceiverAppsWithStatus ${paymentId} started`);
    const senderApp = await this.appInstanceRepository.findTransferAppByAppDefinitionPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.publicIdentifier,
      this.appRegistryService.findByName(SimpleLinkedTransferAppName).appDefinitionAddress,
    );
    const receiverApp = await this.appInstanceRepository.findTransferAppByAppDefinitionPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.publicIdentifier,
      this.appRegistryService.findByName(SimpleLinkedTransferAppName).appDefinitionAddress,
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
  async getLinkedTransfersForReceiverUnlock(userIdentifier: string): Promise<AppInstance[]> {
    this.log.info(`getLinkedTransfersForReceiverUnlock for ${userIdentifier} started`);
    // eslint-disable-next-line max-len
    const transfersFromNodeToUser = await this.appInstanceRepository.findActiveTransferAppsByAppDefinitionToRecipient(
      userIdentifier,
      this.cfCoreService.cfCore.signerAddress,
      this.appRegistryService.findByName(SimpleLinkedTransferAppName).appDefinitionAddress,
    );
    const existingReceiverApps = (
      await Promise.all(
        transfersFromNodeToUser.map(
          async (transfer) =>
            await this.appInstanceRepository.findTransferAppByAppDefinitionPaymentIdAndSender(
              transfer.latestState["paymentId"],
              this.cfCoreService.cfCore.publicIdentifier,
              this.appRegistryService.findByName(SimpleLinkedTransferAppName).appDefinitionAddress,
            ),
        ),
      )
    )
      // remove nulls
      .filter((transfer) => !!transfer);
    const alreadyRedeemedPaymentIds = existingReceiverApps.map(
      (app) => app.latestState["paymentId"],
    );
    const redeemableTransfers = transfersFromNodeToUser.filter(
      (transfer) => !alreadyRedeemedPaymentIds.includes(transfer.latestState["paymentId"]),
    );
    this.log.info(
      `getLinkedTransfersForReceiverUnlock for ${userIdentifier} complete: ${JSON.stringify(
        redeemableTransfers,
      )}`,
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
  async unlockLinkedTransfersFromUser(userIdentifier: string): Promise<string[]> {
    this.log.info(`unlockLinkedTransfersFromUser for ${userIdentifier} started`);
    // eslint-disable-next-line max-len
    const transfersFromUserToNode = await this.appInstanceRepository.findActiveTransferAppsByAppDefinitionFromSenderToNode(
      getSignerAddressFromPublicIdentifier(userIdentifier),
      this.cfCoreService.cfCore.signerAddress,
      this.appRegistryService.findByName(SimpleLinkedTransferAppName).appDefinitionAddress,
    );
    const receiverRedeemed = await Promise.all(
      transfersFromUserToNode.map(async (transfer) =>
        this.appInstanceRepository.findRedeemedTransferAppByAppDefinitionPaymentIdFromNode(
          transfer.latestState["paymentId"],
          this.cfCoreService.cfCore.signerAddress,
          this.appRegistryService.findByName(SimpleLinkedTransferAppName).appDefinitionAddress,
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
          await this.cfCoreService.takeAction(
            senderApp.identityHash,
            senderApp.channel.multisigAddress,
            {
              preImage,
            },
          );
        }
        await this.cfCoreService.uninstallApp(
          senderApp.identityHash,
          senderApp.channel.multisigAddress,
        );
        unlockedAppIds.push(senderApp.identityHash);
        this.log.log(`Unlocked transfer from app ${senderApp.identityHash}`);
      }
    }
    this.log.info(
      `unlockLinkedTransfersFromUser for ${userIdentifier} complete: ${stringify(unlockedAppIds)}`,
    );
    return unlockedAppIds;
  }
}
