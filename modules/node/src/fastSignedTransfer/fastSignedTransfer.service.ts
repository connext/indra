import { SimpleLinkedTransferApp } from "@connext/apps";

import {
  DepositConfirmationMessage,
  ResolveLinkedTransferResponseBigNumber,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DepositFailedMessage,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleLinkedTransferAppState,
} from "@connext/types";
import { Injectable, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { HashZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";

import { FastSignedTransferRepository } from "../fastSignedTransfer/fastSignedTransfer.repository";
import {
  FastSignedTransfer,
  FastSignedTransferStatus,
} from "../fastSignedTransfer/fastSignedTransfer.entity";

@Injectable()
export class LinkedTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
    private readonly fastSignedTransferRespository: FastSignedTransferRepository,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
  ) {
    this.log.setContext("FastSignedTransferService");
  }

  async saveFastSignedTransfer(
    senderPubId: string,
    assetId: string,
    amount: BigNumber,
    appInstanceId: string,
    signer: string,
    paymentId: string,
    recipientPublicIdentifier?: string,
    meta?: object,
  ): Promise<FastSignedTransfer> {
    const senderChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      senderPubId,
    );
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      recipientPublicIdentifier,
    );

    const transfer = new FastSignedTransfer();
    transfer.senderAppInstanceId = appInstanceId;
    transfer.amount = amount;
    transfer.assetId = assetId;
    transfer.paymentId = paymentId;
    transfer.signer = signer;
    transfer.meta = meta;
    transfer.senderChannel = senderChannel;
    transfer.receiverChannel = receiverChannel;
    transfer.status = FastSignedTransferStatus.PENDING;

    return await this.fastSignedTransferRespository.save(transfer);
  }
}
