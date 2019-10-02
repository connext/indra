import { IMessagingService } from "@connext/messaging";
import { ResolveLinkedTransferResponse } from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { bigNumberify } from "ethers/utils";

import { AuthService } from "../auth/auth.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider, CLogger, replaceBN } from "../util";

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

  async resolveLinkedTransfer(
    pubId: string,
    data: {
      paymentId: string;
      preImage: string;
      amount: string;
      assetId: string;
    },
  ): Promise<ResolveLinkedTransferResponse> {
    logger.log(`Got resolve link request with data: ${JSON.stringify(data, replaceBN, 2)}`);
    const { paymentId, preImage, amount, assetId } = data;
    if (!paymentId || !preImage || !amount || !assetId) {
      throw new RpcException(`Incorrect data received. Data: ${data}`);
    }
    return await this.transferService.resolveLinkedTransfer(
      pubId,
      paymentId,
      preImage,
      bigNumberify(amount),
      assetId,
    );
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      "transfer.resolve-linked.>",
      this.authService.useVerifiedPublicIdentifier(this.resolveLinkedTransfer.bind(this)),
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
