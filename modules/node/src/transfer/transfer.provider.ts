import { IMessagingService } from "@connext/messaging";
import { ResolveLinkedTransferResponse, Transfer } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";

import { AuthService } from "../auth/auth.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider, CLogger, replaceBN } from "../util";

import { LinkedTransfer } from "./transfer.entity";
import { TransferService } from "./transfer.service";

const logger = new CLogger("TransferMessaging");

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    messaging: IMessagingService,
    private readonly transferService: TransferService,
    private readonly authService: AuthService,
  ) {
    super(messaging);
  }

  async getLinkedTransferByPaymentId(
    pubId: string,
    data: { paymentId: string },
  ): Promise<Transfer> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    logger.log(`Got fetch link request for: ${data.paymentId}`);
    return await this.transferService.getTransferByPaymentId(data.paymentId);
  }

  async resolveLinkedTransfer(
    pubId: string,
    data: { paymentId: string; linkedHash: string; meta: object },
  ): Promise<ResolveLinkedTransferResponse> {
    logger.log(`Got resolve link request with data: ${JSON.stringify(data, replaceBN, 2)}`);
    const { paymentId, linkedHash, meta } = data;
    if (!paymentId || !linkedHash) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    return await this.transferService.resolveLinkedTransfer(pubId, paymentId, linkedHash, meta);
  }

  // TODO: types
  async setRecipientOnLinkedTransfer(
    pubId: string,
    data: {
      recipientPublicIdentifier: string;
      linkedHash: string;
      encryptedPreImage: string;
    },
  ): Promise<{ linkedHash: string }> {
    const { recipientPublicIdentifier, linkedHash, encryptedPreImage } = data;
    if (!recipientPublicIdentifier) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }

    const transfer = await this.transferService.setRecipientAndEncryptedPreImageOnLinkedTransfer(
      pubId,
      recipientPublicIdentifier,
      encryptedPreImage,
      linkedHash,
    );
    return { linkedHash: transfer.linkedHash };
  }

  async getPendingTransfers(pubId: string, data?: unknown): Promise<{ paymentId: string }[]> {
    const transfers = await this.transferService.getPendingTransfers(pubId);
    return transfers.map((transfer: LinkedTransfer) => {
      const { assetId, amount, encryptedPreImage, linkedHash, paymentId } = transfer;
      return { assetId, amount: amount.toString(), encryptedPreImage, linkedHash, paymentId };
    });
  }

  async getTransferHistory(pubId: string): Promise<Transfer[]> {
    return await this.transferService.getTransfersByPublicIdentifier(pubId);
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.fetch-linked.>",
      this.authService.useVerifiedPublicIdentifier(this.getLinkedTransferByPaymentId.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.resolve-linked.>",
      this.authService.useVerifiedPublicIdentifier(this.resolveLinkedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.set-recipient.>",
      this.authService.useVerifiedPublicIdentifier(this.setRecipientOnLinkedTransfer.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.get-pending.>",
      this.authService.useVerifiedPublicIdentifier(this.getPendingTransfers.bind(this)),
    );
    await super.connectRequestReponse(
      "transfer.get-history.>",
      this.authService.useUnverifiedPublicIdentifier(this.getTransferHistory.bind(this)),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [MessagingProviderId, TransferService, AuthService],
  provide: TransferProviderId,
  useFactory: async (
    messaging: IMessagingService,
    transferService: TransferService,
    authService: AuthService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(messaging, transferService, authService);
    await transfer.setupSubscriptions();
  },
};
