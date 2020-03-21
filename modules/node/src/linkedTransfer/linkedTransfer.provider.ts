import { convertLinkedTransferAppState } from "@connext/apps";
import { MessagingService } from "@connext/messaging";
import {
  ResolveLinkedTransferResponse,
  GetLinkedTransferResponse,
  replaceBN,
  SimpleLinkedTransferAppState,
  LinkedTransferStatus,
  GetPendingAsyncTransfersResponse,
  // TransferType,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, LinkedTransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../util";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

import { LinkedTransferService, appStatusesToLinkedTransferStatus } from "./linkedTransfer.service";
import { CFCoreService } from "../cfCore/cfCore.service";

export class LinkedTransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly cfCoreService: CFCoreService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    super(log, messaging);
    log.setContext("LinkedTransferMessaging");
  }

  async getLinkedTransferByPaymentId(
    pubId: string,
    data: { paymentId: string },
  ): Promise<GetLinkedTransferResponse | undefined> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got fetch link request for: ${data.paymentId}`);
    // should really only ever be 1 active at a time
    // TODO: is this always true?
    // might need to check for duplicate paymentIds when we create a transfer
    const transferApps = await this.appInstanceRepository.findLinkedTransferAppsByPaymentId(
      data.paymentId,
    );

    if (transferApps.length === 0) {
      return undefined;
    }

    // determine status
    // node receives transfer in sender app
    const senderApp = transferApps.find(
      app =>
        convertLinkedTransferAppState("bignumber", app.latestState as SimpleLinkedTransferAppState)
          .coinTransfers[1].to === this.cfCoreService.cfCore.freeBalanceAddress,
    );
    const receiverApp = transferApps.find(
      app =>
        convertLinkedTransferAppState("bignumber", app.latestState as SimpleLinkedTransferAppState)
          .coinTransfers[0].to === this.cfCoreService.cfCore.freeBalanceAddress,
    );

    if (!senderApp) {
      return undefined;
    }
    console.log(LinkedTransferStatus);

    // if sender app is uninstalled, transfer has been unlocked by node
    const status = appStatusesToLinkedTransferStatus(senderApp.type, receiverApp?.type);

    const latestState = convertLinkedTransferAppState(
      "bignumber",
      senderApp.latestState as SimpleLinkedTransferAppState,
    );
    const { encryptedPreImage, recipient, ...meta } = senderApp.meta || ({} as any);
    return {
      amount: latestState.amount.toString(),
      meta: meta || {},
      assetId: latestState.assetId,
      createdAt: senderApp.createdAt,
      paymentId: latestState.paymentId,
      senderPublicIdentifier: senderApp.channel.userPublicIdentifier,
      status,
      encryptedPreImage: encryptedPreImage || "",
      receiverPublicIdentifier: recipient || "",
      type: "LINKED" as any, // TransferType.LINKED
      // ^^ TODO: why does enum from types not work?
    };
  }

  async resolveLinkedTransfer(
    pubId: string,
    { paymentId }: { paymentId: string },
  ): Promise<ResolveLinkedTransferResponse> {
    this.log.debug(
      `Got resolve link request with data: ${JSON.stringify(paymentId, replaceBN, 2)}`,
    );
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(paymentId)}`);
    }
    const response = await this.linkedTransferService.resolveLinkedTransfer(pubId, paymentId);
    return {
      ...response,
      amount: response.amount.toString(),
    };
  }

  async getPendingTransfers(pubId: string): Promise<GetPendingAsyncTransfersResponse[]> {
    throw new Error("linkedTransfer.provider#getPendingTransfers not implemented");
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "*.transfer.fetch-linked",
      this.authService.parseXpub(this.getLinkedTransferByPaymentId.bind(this)),
    );
    await super.connectRequestReponse(
      "*.transfer.resolve-linked",
      this.authService.parseXpub(this.resolveLinkedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      "*.transfer.get-pending",
      this.authService.parseXpub(this.getPendingTransfers.bind(this)),
    );
  }
}

export const linkedTransferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    CFCoreService,
    LinkedTransferService,
    AppInstanceRepository,
  ],
  provide: LinkedTransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    cfCoreService: CFCoreService,
    linkedTransferService: LinkedTransferService,
    appInstanceRepository: AppInstanceRepository,
  ): Promise<void> => {
    const transfer = new LinkedTransferMessaging(
      authService,
      logging,
      messaging,
      cfCoreService,
      linkedTransferService,
      appInstanceRepository,
    );
    await transfer.setupSubscriptions();
  },
};
