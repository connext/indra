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

  async resolveLinkedTransfer(
    subject: string,
    data: {
      paymentId: string;
      preImage: string;
      amount: string;
      assetId: string;
      recipientPublicIdentifier?: string;
    },
  ): Promise<ResolveLinkedTransferResponse> {
    const userPubId = this.getPublicIdentifierFromSubject(subject);
    const { paymentId, preImage, amount, assetId, recipientPublicIdentifier } = data;
    if (!paymentId || !preImage || !amount || !assetId) {
      throw new RpcException(`Incorrect data received. Data: ${data}`);
    }
    return await this.transferService.resolveLinkedTransfer(
      userPubId,
      paymentId,
      preImage,
      bigNumberify(amount),
      assetId,
      recipientPublicIdentifier,
    );
  }

  // TODO: types
  async setRecipientOnLinkedTransfer(
    subject: string,
    data: { recipientPublicIdentifier: string; linkedHash: string },
  ): Promise<{ linkedHash: string }> {
    const userPubId = this.getPublicIdentifierFromSubject(subject);
    const { recipientPublicIdentifier, linkedHash } = data;
    if (!recipientPublicIdentifier) {
      throw new RpcException(`Incorrect data received. Data: ${data}`);
    }

    const transfer = await this.transferService.setRecipientOnLinkedTransfer(
      userPubId,
      recipientPublicIdentifier,
      linkedHash,
    );
    return { linkedHash: transfer.linkedHash };
  }

  async getPendingTransfers(subject: string): Promise<{ paymentId: string }[]> {
    const userPubId = this.getPublicIdentifierFromSubject(subject);

    const transfers = await this.transferService.getPendingTransfers(userPubId);
    return transfers.map((transfer: LinkedTransfer) => {
      return { paymentId: transfer.paymentId };
    });
  }

  async setupSubscriptions(): Promise<void> {
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
