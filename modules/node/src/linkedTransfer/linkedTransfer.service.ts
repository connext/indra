import { LinkedTransferStatus, SimpleLinkedTransferAppName } from "@connext/types";
import { Injectable } from "@nestjs/common";

import { CFCoreService } from "../cfCore/cfCore.service";
import { LoggerService } from "../logger/logger.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { AppInstance } from "../appInstance/appInstance.entity";
import { appStatusesToTransferStatus } from "../utils";

const appStatusesToLinkedTransferStatus = (
  senderApp: AppInstance<typeof SimpleLinkedTransferAppName>,
  receiverApp?: AppInstance<typeof SimpleLinkedTransferAppName>,
): LinkedTransferStatus | undefined => {
  return appStatusesToTransferStatus<typeof SimpleLinkedTransferAppName>(senderApp, receiverApp);
};

@Injectable()
export class LinkedTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly log: LoggerService,
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
      this.cfCoreService.getAppInfoByName(SimpleLinkedTransferAppName).appDefinitionAddress,
    );
    const receiverApp = await this.appInstanceRepository.findTransferAppByAppDefinitionPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.publicIdentifier,
      this.cfCoreService.getAppInfoByName(SimpleLinkedTransferAppName).appDefinitionAddress,
    );
    // if sender app is uninstalled, transfer has been unlocked by node
    const status = appStatusesToLinkedTransferStatus(senderApp, receiverApp);

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
      this.cfCoreService.getAppInfoByName(SimpleLinkedTransferAppName).appDefinitionAddress,
    );
    const existingReceiverApps = (
      await Promise.all(
        transfersFromNodeToUser.map(
          async (transfer) =>
            await this.appInstanceRepository.findTransferAppByAppDefinitionPaymentIdAndSender(
              transfer.latestState["paymentId"],
              this.cfCoreService.cfCore.publicIdentifier,
              this.cfCoreService.getAppInfoByName(SimpleLinkedTransferAppName).appDefinitionAddress,
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
}
