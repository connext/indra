import { IMessagingService } from "@connext/messaging";
import { ResolveLinkedTransferResponse } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { bigNumberify } from "ethers/utils";

import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider, CLogger } from "../util";

import { LinkedTransfer } from "./transfer.entity";
import { TransferService } from "./transfer.service";

const logger = new CLogger("TransferMessaging");

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(messaging: IMessagingService, private readonly transferService: TransferService) {
    super(messaging);
  }

  async fetchLinkedTransfer(
    subject: string,
    data: {
      paymentId: string;
    },
  ): Promise<any> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${data}`);
    }
    logger.log(`Got fetch link request for: ${data.paymentId}`);
    return await this.transferService.fetchLinkedTransfer(data.paymentId);
  }

  async resolveLinkedTransfer(
    subject: string,
    data: {
      paymentId: string;
      preImage: string;
      recipientPublicIdentifier?: string;
    },
  ): Promise<ResolveLinkedTransferResponse> {
    const userPubId = this.getPublicIdentifierFromSubject(subject);
    const { paymentId, preImage, recipientPublicIdentifier } = data;
    if (!paymentId || !preImage) {
      throw new RpcException(`Incorrect data received. Data: ${data}`);
    }
    return await this.transferService.resolveLinkedTransfer(
      userPubId,
      paymentId,
      preImage,
      recipientPublicIdentifier,
    );
  }

  // TODO: types
  async setRecipientOnLinkedTransfer(
    subject: string,
    data: {
      recipientPublicIdentifier: string;
      linkedHash: string;
      encryptedPreImage: string;
    },
  ): Promise<{ linkedHash: string }> {
    const userPubId = this.getPublicIdentifierFromSubject(subject);
    const { recipientPublicIdentifier, linkedHash, encryptedPreImage } = data;
    if (!recipientPublicIdentifier) {
      throw new RpcException(`Incorrect data received. Data: ${data}`);
    }

    const transfer = await this.transferService.setRecipientAndEncryptedPreImageOnLinkedTransfer(
      userPubId,
      recipientPublicIdentifier,
      encryptedPreImage,
      linkedHash,
    );
    return { linkedHash: transfer.linkedHash };
  }

  async getPendingTransfers(subject: string): Promise<{ paymentId: string }[]> {
    const userPubId = this.getPublicIdentifierFromSubject(subject);

    const transfers = await this.transferService.getPendingTransfers(userPubId);
    return transfers.map((transfer: LinkedTransfer) => {
      const { assetId, amount, encryptedPreImage, linkedHash, paymentId } = transfer;
      return { assetId, amount: amount.toString(), encryptedPreImage, linkedHash, paymentId };
    });
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.fetch-linked.>",
      this.fetchLinkedTransfer.bind(this),
    );
    await super.connectRequestReponse(
      "transfer.resolve-linked.>",
      this.resolveLinkedTransfer.bind(this),
    );
    await super.connectRequestReponse(
      "transfer.set-recipient.>",
      this.setRecipientOnLinkedTransfer.bind(this),
    );
    await super.connectRequestReponse(
      "transfer.get-pending.>",
      this.getPendingTransfers.bind(this),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [MessagingProviderId, TransferService],
  provide: TransferProviderId,
  useFactory: async (
    messaging: IMessagingService,
    transferService: TransferService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(messaging, transferService);
    await transfer.setupSubscriptions();
  },
};
