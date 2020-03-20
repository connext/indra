import {
  DepositConfirmationMessage,
  ResolveLinkedTransferResponseBigNumber,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DepositFailedMessage,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleLinkedTransferAppState,
  SimpleLinkedTransferApp,
} from "@connext/types";
import { Injectable, Inject } from "@nestjs/common";
import { HashZero, Zero } from "ethers/constants";
import { BigNumber, bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { MessagingProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";
import { xkeyKthAddress } from "../util";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

import { MessagingService } from "@connext/messaging";
import { convertLinkedTransferAppState } from "@connext/apps";

@Injectable()
export class LinkedTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly log: LoggerService,
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("LinkedTransferService");
  }

  async resolveLinkedTransfer(
    userPubId: string,
    paymentId: string,
  ): Promise<ResolveLinkedTransferResponseBigNumber> {
    this.log.debug(`resolveLinkedTransfer(${userPubId}, ${paymentId})`);
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(userPubId);

    // check that we have recorded this transfer in our db
    // TODO: handle offline case
    const [senderApp] = await this.appInstanceRepository.findLinkedTransferAppsByPaymentId(
      paymentId,
    );
    if (!senderApp) {
      throw new Error(`Sender app was not found with paymentId: ${paymentId}`);
    }

    const { assetId, amount, linkedHash } = convertLinkedTransferAppState(
      "bignumber",
      senderApp.latestState as SimpleLinkedTransferAppState,
    );
    const amountBN = bigNumberify(amount);

    this.log.debug(`Found linked transfer in our database, attempting to install...`);

    const freeBalanceAddr = this.cfCoreService.cfCore.freeBalanceAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );
    if (freeBal[freeBalanceAddr].lt(amountBN)) {
      // request collateral and wait for deposit to come through
      // TODO: expose remove listener
      await new Promise(async (resolve, reject) => {
        this.cfCoreService.cfCore.on(
          DEPOSIT_CONFIRMED_EVENT,
          async (msg: DepositConfirmationMessage) => {
            if (msg.from !== this.cfCoreService.cfCore.publicIdentifier) {
              // do not reject promise here, since theres a chance the event is
              // emitted for another user depositing into their channel
              this.log.debug(
                `Deposit event from field: ${msg.from}, did not match public identifier: ${this.cfCoreService.cfCore.publicIdentifier}`,
              );
              return;
            }
            if (msg.data.multisigAddress !== channel.multisigAddress) {
              // do not reject promise here, since theres a chance the event is
              // emitted for node collateralizing another users' channel
              this.log.debug(
                `Deposit event multisigAddress: ${msg.data.multisigAddress}, did not match channel multisig address: ${channel.multisigAddress}`,
              );
              return;
            }
            // make sure free balance is appropriate
            const fb = await this.cfCoreService.getFreeBalance(
              userPubId,
              channel.multisigAddress,
              assetId,
            );
            if (fb[freeBalanceAddr].lt(amountBN)) {
              return reject(
                `Free balance associated with ${freeBalanceAddr} is less than transfer amount: ${amountBN}`,
              );
            }
            resolve();
          },
        );
        this.cfCoreService.cfCore.on(DEPOSIT_FAILED_EVENT, (msg: DepositFailedMessage) => {
          return reject(JSON.stringify(msg, null, 2));
        });
        try {
          await this.channelService.rebalance(
            userPubId,
            assetId,
            RebalanceType.COLLATERALIZE,
            amountBN,
          );
        } catch (e) {
          return reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(userPubId, assetId, RebalanceType.COLLATERALIZE, amountBN);
    }

    const initialState: SimpleLinkedTransferAppStateBigNumber = {
      amount: amountBN,
      assetId,
      coinTransfers: [
        {
          amount: amountBN,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: xkeyKthAddress(userPubId),
        },
      ],
      linkedHash,
      paymentId,
      preImage: HashZero,
    };

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      channel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      SimpleLinkedTransferApp,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appInstanceId) {
      throw new Error(`Could not install app on receiver side.`);
    }

    return {
      appId: receiverAppInstallRes.appInstanceId,
      sender: senderApp.channel.userPublicIdentifier,
      meta: {}, // TODO:
      paymentId,
      amount,
      assetId,
    };
  }

  async getLinkedTransfersForReclaim(userPublicIdentifier: string): Promise<any> {
    throw new Error(`Unimplemented`);
  }
}
