import { IMessagingService } from "@connext/messaging";
import { ResolveLinkedTransferResponse } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { bigNumberify } from "ethers/utils";

import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider, CLogger, replaceBN } from "../util";

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
    },
  ): Promise<ResolveLinkedTransferResponse> {
    logger.log(`Got resolve link request with data: ${JSON.stringify(data, replaceBN, 2)}`);
    const userPubId = this.getPublicIdentifierFromSubject(subject);
    const { paymentId, preImage } = data;
    if (!paymentId || !preImage) {
      throw new RpcException(`Incorrect data received. Data: ${data}`);
    }
    return await this.transferService.resolveLinkedTransfer(userPubId, paymentId, preImage);
  }

  setupSubscriptions(): void {
    super.connectRequestReponse("transfer.fetch-linked.>", this.fetchLinkedTransfer.bind(this));
    super.connectRequestReponse("transfer.resolve-linked.>", this.resolveLinkedTransfer.bind(this));
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
