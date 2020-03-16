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
  FastSignedTransferApp,
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
import { convertFastSignedTransferAppState } from "@connext/apps";

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
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
  ) {
    this.log.setContext("FastSignedTransferService");
  }

  async resolveFastSignedTransfer(
    userPublicIdentifier: string,
    paymentId: string,
  ): Promise<ResolveFastSignedTransferResponse<BigNumber>> {
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      userPublicIdentifier,
    );
    this.log.debug(`resolveLinkedTransfer(${userPublicIdentifier}, ${paymentId})`);

    // get sender app from installed apps and receiver app if it exists
    const [installedSenderApp] = await this.cfCoreService.getFastSignedTransferAppsByPaymentId(
      paymentId,
    );
    const senderChannel = await this.channelRepository.findByMultisigAddressOrThrow(
      installedSenderApp.multisigAddress,
    );
    if (!installedSenderApp) {
      throw new Error(`Sender app not installed for paymentId ${paymentId}`);
    }
    const latestSenderState = convertFastSignedTransferAppState(
      "bignumber",
      installedSenderApp.latestState as FastSignedTransferAppStateBigNumber,
    );
    const transferAmount = latestSenderState.amount;
    const transferSigner = latestSenderState.signer;

    const [installedReceiverApp] = await this.cfCoreService.getAppInstancesByAppName(
      receiverChannel.multisigAddress,
      "FastSignedTransferApp",
    );

    let installedAppInstanceId: string;

    let needsInstall: boolean = true;
    // install if needed
    if (installedReceiverApp) {
      const latestReceiverState = convertFastSignedTransferAppState(
        "bignumber",
        installedReceiverApp.latestState as FastSignedTransferAppStateBigNumber,
      );
      const availableTransferBalance = latestReceiverState.coinTransfers[0].amount;
      if (availableTransferBalance.gte(transferAmount)) {
        needsInstall = false;
        installedAppInstanceId = installedReceiverApp.identityHash;
      } else {
        // uninstall
        await this.cfCoreService.uninstallApp(installedReceiverApp.identityHash);
      }
    }

    if (needsInstall) {
      this.log.debug(`Could not find app that allows transfer, installing a new one`);
      installedAppInstanceId = await this.installFastTransferApp(
        receiverChannel,
        installedSenderApp.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
        transferAmount,
      );
    } else {
      installedAppInstanceId = installedReceiverApp.identityHash;
    }

    const appAction = {
      actionType: FastSignedTransferActionType.CREATE,
      amount: transferAmount,
      paymentId,
      recipientXpub: receiverChannel.userPublicIdentifier,
      signer: transferSigner,
      signature: hexZeroPad(HashZero, 65),
      data: HashZero,
    } as FastSignedTransferAppActionBigNumber;

    await this.cfCoreService.takeAction(installedAppInstanceId, appAction);

    return {
      appId: installedAppInstanceId,
      sender: senderChannel.userPublicIdentifier,
      signer: transferSigner,
      meta: {},
      paymentId,
      amount: transferAmount,
      assetId: installedSenderApp.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress,
    };
  }

  private async installFastTransferApp(
    channel: Channel,
    assetId: string,
    transferAmount: BigNumber,
  ): Promise<string> {
    const freeBalanceAddr = this.cfCoreService.cfCore.freeBalanceAddress;

    let {
      [this.cfCoreService.cfCore.freeBalanceAddress]: nodeFreeBalancePreCollateral,
    } = await this.cfCoreService.getFreeBalance(
      channel.userPublicIdentifier,
      channel.multisigAddress,
      assetId,
    );
    let depositAmount = nodeFreeBalancePreCollateral;
    if (nodeFreeBalancePreCollateral.lt(transferAmount)) {
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
            let {
              [this.cfCoreService.cfCore.freeBalanceAddress]: nodeFreeBalancePostCollateral,
            } = await this.cfCoreService.getFreeBalance(
              channel.userPublicIdentifier,
              channel.multisigAddress,
              assetId,
            );
            depositAmount = nodeFreeBalancePostCollateral;
            resolve();
          },
        );
        this.cfCoreService.cfCore.on(DEPOSIT_FAILED_EVENT, (msg: DepositFailedMessage) => {
          return reject(JSON.stringify(msg, null, 2));
        });
        try {
          await this.channelService.rebalance(
            channel.userPublicIdentifier,
            assetId,
            RebalanceType.COLLATERALIZE,
            transferAmount,
          );
        } catch (e) {
          return reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(
        channel.userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
      );
    }

    const initialState: FastSignedTransferAppStateBigNumber = {
      coinTransfers: [
        {
          // install full free balance into app, this will be optimized by rebalancing service
          amount: depositAmount,
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
      channel,
      initialState,
      depositAmount,
      assetId,
      Zero,
      assetId,
      FastSignedTransferApp,
    );

    return receiverAppInstallRes.appInstanceId;
  }
}
