import { MessagingService } from "@connext/messaging";
import {
  NodeResponses,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  ConditionalTransferTypes,
  RequireOnlineApps,
  LinkedTransferStatus,
} from "@connext/types";
import { FactoryProvider } from "@nestjs/common/interfaces";
import { RpcException } from "@nestjs/microservices";
import { stringify } from "@connext/utils";

import { AuthService } from "../auth/auth.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId, TransferProviderId } from "../constants";
import { AbstractMessagingProvider } from "../messaging/abstract.provider";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import { ConfigService } from "../config/config.service";

import { TransferService } from "./transfer.service";

export class TransferMessaging extends AbstractMessagingProvider {
  constructor(
    private readonly authService: AuthService,
    log: LoggerService,
    messaging: MessagingService,
    private readonly configService: ConfigService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly transferService: TransferService,
  ) {
    super(log, messaging);
    this.log.setContext("TransferMessaging");
  }

  async getTransferHistory(pubId: string): Promise<NodeResponses.GetTransferHistory> {
    throw new Error("Unimplemented");
  }

  /**
   * Check in endpoint for client to call when it comes online to handle pending tasks
   * @param userIdentifier
   */
  async clientCheckIn(userIdentifier: string, chainId: number): Promise<void> {
    // reclaim collateral from redeemed transfers
    await this.transferService.unlockSenderApps(userIdentifier);
    // unlock all transfers by looking up by payment Id and using last action
  }

  async resolveLinkedTransfer(
    pubId: string,
    chainId: number,
    { paymentId }: { paymentId: string },
  ): Promise<NodeResponses.ResolveLinkedTransfer> {
    this.log.debug(`Got resolve link request with data: ${stringify(paymentId)}`);
    if (!paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(paymentId)}`);
    }

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      chainId,
      paymentId,
      SimpleLinkedTransferAppName,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async resolveSignedTransfer(
    pubId: string,
    chainId: number,
    data: { paymentId: string },
  ): Promise<NodeResponses.ResolveSignedTransfer> {
    if (!data.paymentId) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }
    this.log.info(`Got resolve signed transfer request with paymentId: ${data.paymentId}`);

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      chainId,
      data.paymentId,
      SimpleSignedTransferAppName,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async installPendingTransfers(
    userIdentifier: string,
    chainId: number,
  ): Promise<NodeResponses.GetPendingAsyncTransfers> {
    const transfers = await this.linkedTransferService.getLinkedTransfersForReceiverUnlockOnChain(
      userIdentifier,
      chainId,
    );
    for (const transfer of transfers) {
      await this.transferService.resolveByPaymentId(
        userIdentifier,
        chainId,
        transfer.meta.paymentId,
        ConditionalTransferTypes.LinkedTransfer,
      );
    }
    return transfers.map((transfer) => {
      return {
        paymentId: transfer.meta.paymentId,
        createdAt: transfer.createdAt,
        amount: transfer.latestState.coinTransfers[0].amount,
        assetId: transfer.initiatorDepositAssetId,
        senderIdentifier: transfer.channel.userIdentifier,
        receiverIdentifier: transfer.meta.recipient,
        status: LinkedTransferStatus.PENDING,
        meta: transfer.meta,
        encryptedPreImage: transfer.meta.encryptedPreImage,
      };
    });
  }

  async installConditionalTransferReceiverApp(
    pubId: string,
    chainId: number,
    data: { paymentId: string; conditionType: ConditionalTransferTypes },
  ): Promise<NodeResponses.InstallConditionalTransferReceiverApp> {
    if (!data.paymentId || !data.conditionType) {
      throw new RpcException(`Incorrect data received. Data: ${JSON.stringify(data)}`);
    }

    // TODO: what about linked transfer apps w a requireOnline flag in meta?
    if (RequireOnlineApps.includes(data.conditionType)) {
      throw new Error(`Apps that require an online recipient cannot be installed through node API`);
    }
    this.log.info(`Got installReceiverApp request with paymentId: ${data.paymentId}`);

    const response = await this.transferService.resolveByPaymentId(
      pubId,
      chainId,
      data.paymentId,
      data.conditionType,
    );
    return {
      ...response,
      amount: response.amount,
    };
  }

  async setupSubscriptions(): Promise<void> {
    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.get-history`,
      this.authService.parseIdentifierAndChain(this.getTransferHistory.bind(this)),
    );

    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.install-linked`,
      this.authService.parseIdentifierAndChain(this.resolveLinkedTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.install-signed`,
      this.authService.parseIdentifierAndChain(this.resolveSignedTransfer.bind(this)),
    );

    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.client.check-in`,
      this.authService.parseIdentifierAndChain(this.clientCheckIn.bind(this)),
    );

    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.install-receiver`,
      this.authService.parseIdentifierAndChain(
        this.installConditionalTransferReceiverApp.bind(this),
      ),
    );

    await super.connectRequestReponse(
      `*.${this.configService.getPublicIdentifier()}.*.transfer.install-pending`,
      this.authService.parseIdentifierAndChain(this.installPendingTransfers.bind(this)),
    );
  }
}

export const transferProviderFactory: FactoryProvider<Promise<void>> = {
  inject: [
    AuthService,
    LoggerService,
    MessagingProviderId,
    ConfigService,
    LinkedTransferService,
    TransferService,
  ],
  provide: TransferProviderId,
  useFactory: async (
    authService: AuthService,
    logging: LoggerService,
    messaging: MessagingService,
    configService: ConfigService,
    linkedTransferService: LinkedTransferService,
    transferService: TransferService,
  ): Promise<void> => {
    const transfer = new TransferMessaging(
      authService,
      logging,
      messaging,
      configService,
      linkedTransferService,
      transferService,
    );
    await transfer.setupSubscriptions();
  },
};
