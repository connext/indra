import { FastSignedTransferApp } from "@connext/apps";
import { xkeyKthAddress } from "@connext/cf-core";
import {
  DepositConfirmationMessage,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DepositFailedMessage,
  AppInstanceJson,
  FastSignedTransferAppStateBigNumber,
  FastSignedTransferAppActionBigNumber,
  FastSignedTransferActionType,
  ResolveFastSignedTransferResponse,
} from "@connext/types";
import { Injectable, Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { HashZero, Zero, AddressZero } from "ethers/constants";
import { BigNumber, hexZeroPad } from "ethers/utils";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { MessagingClientProviderId } from "../constants";
import { LoggerService } from "../logger/logger.service";
import { Channel } from "../channel/channel.entity";

import { FastSignedTransferRepository } from "../fastSignedTransfer/fastSignedTransfer.repository";
import {
  FastSignedTransfer,
  FastSignedTransferStatus,
} from "../fastSignedTransfer/fastSignedTransfer.entity";

const findInstalledFastSignedAppWithSpace = (
  apps: AppInstanceJson[],
  recipientFreeBalanceAddress: string,
  fastSignedTransferAppDefAddress: string,
): AppInstanceJson | undefined => {
  return apps.find(app => {
    const latestState = app.latestState as FastSignedTransferAppStateBigNumber;
    return (
      app.appInterface.addr === fastSignedTransferAppDefAddress && // interface matches
      latestState.coinTransfers[1][0] === recipientFreeBalanceAddress // recipient matches
    );
  });
};

@Injectable()
export class FastSignedTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly appRegistryRepository: AppRegistryRepository,
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

  async resolveFastSignedTransfer(
    userPublicIdentifier: string,
    paymentId: string,
  ): Promise<ResolveFastSignedTransferResponse<BigNumber>> {
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userPublicIdentifier,
    );
    this.log.debug(`resolveLinkedTransfer(${userPublicIdentifier}, ${paymentId})`);
    // check that we have recorded this transfer in our db
    const transfer = await this.fastSignedTransferRespository.findByPaymentIdOrThrow(paymentId);

    if (transfer.status !== FastSignedTransferStatus.PENDING) {
      throw new Error(
        `Transfer with paymentId ${paymentId} cannot be redeemed with status: ${transfer.status}`,
      );
    }

    this.log.debug(`Found fast signed transfer in our database, attempting to resolve...`);
    const apps = await this.cfCoreService.getAppInstances(receiverChannel.multisigAddress);
    const ethNetwork = await this.configService.getEthNetwork();
    const fastSignedTransferApp = await this.appRegistryRepository.findByNameAndNetwork(
      FastSignedTransferApp,
      ethNetwork.chainId,
    );
    let installedReceiverApp = findInstalledFastSignedAppWithSpace(
      apps,
      xkeyKthAddress(receiverChannel.userPublicIdentifier),
      fastSignedTransferApp.appDefinitionAddress,
    );

    let installedAppInstanceId: string;

    let needsInstall: boolean = true;
    // install if needed
    if (installedReceiverApp) {
      if (
        (installedReceiverApp.latestState as FastSignedTransferAppStateBigNumber).coinTransfers[0][1].gte(
          transfer.amount,
        )
      ) {
        needsInstall = false;
        installedAppInstanceId = installedReceiverApp.identityHash;
      } else {
        // uninstall
        await this.cfCoreService.uninstallApp(installedReceiverApp.identityHash);
      }
    }

    if (needsInstall) {
      this.log.debug(`Could not find app that allows transfer, installing a new one`);
      installedAppInstanceId = await this.installFastTransferApp(receiverChannel, transfer);
    } else {
      installedAppInstanceId = installedReceiverApp.identityHash;
    }
    transfer.receiverAppInstanceId = installedAppInstanceId;
    transfer.receiverChannel = receiverChannel;
    await this.fastSignedTransferRespository.save(transfer);

    const appAction = {
      actionType: FastSignedTransferActionType.CREATE,
      amount: transfer.amount,
      paymentId,
      recipientXpub: receiverChannel.userPublicIdentifier,
      signer: transfer.signer,
      signature: hexZeroPad(HashZero, 65),
      data: HashZero,
    } as FastSignedTransferAppActionBigNumber;

    await this.cfCoreService.takeAction(installedAppInstanceId, appAction);

    return {
      appId: installedAppInstanceId,
      sender: transfer.senderChannel.userPublicIdentifier,
      signer: transfer.signer,
      meta: transfer.meta,
      paymentId,
      amount: transfer.amount,
      assetId: transfer.assetId,
    };
  }

  private async installFastTransferApp(
    channel: Channel,
    transfer: FastSignedTransfer,
  ): Promise<string> {
    const freeBalanceAddr = this.cfCoreService.cfCore.freeBalanceAddress;

    let freeBal = await this.cfCoreService.getFreeBalance(
      channel.userPublicIdentifier,
      channel.multisigAddress,
      transfer.assetId,
    );
    if (freeBal[freeBalanceAddr].lt(transfer.amount)) {
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
            freeBal = await this.cfCoreService.getFreeBalance(
              channel.userPublicIdentifier,
              channel.multisigAddress,
              transfer.assetId,
            );
            if (freeBal[freeBalanceAddr].lt(transfer.amount)) {
              return reject(
                `Free balance associated with ${freeBalanceAddr} is less than transfer amount: ${transfer.amount}`,
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
            channel.userPublicIdentifier,
            transfer.assetId,
            RebalanceType.COLLATERALIZE,
            transfer.amount,
          );
        } catch (e) {
          return reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(
        channel.userPublicIdentifier,
        transfer.assetId,
        RebalanceType.COLLATERALIZE,
        transfer.amount,
      );
    }

    const initialState: FastSignedTransferAppStateBigNumber = {
      coinTransfers: [
        {
          // install full free balance into app, this will be optimized by rebalancing service
          amount: freeBal[freeBalanceAddr],
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: xkeyKthAddress(channel.userPublicIdentifier),
        },
      ],
      amount: Zero,
      paymentId: HashZero,
      recipientXpub: "",
      signer: AddressZero,
      turnNum: Zero,
    };

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      channel.userPublicIdentifier,
      initialState,
      transfer.amount,
      transfer.assetId,
      Zero,
      transfer.assetId,
      FastSignedTransferApp,
    );

    return receiverAppInstallRes.appInstanceId;
  }
}
