import { xkeyKthAddress } from "@connext/cf-core";
import {
  EventNames,
  FastSignedTransferActionType,
  FastSignedTransferAppAction,
  FastSignedTransferAppName,
  FastSignedTransferAppState,
  ResolveFastSignedTransferResponse,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero, AddressZero } from "ethers/constants";
import { BigNumber, hexZeroPad } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { Channel } from "../channel/channel.entity";

@Injectable()
export class FastSignedTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("FastSignedTransferService");
  }

  async resolveFastSignedTransfer(
    userPublicIdentifier: string,
    paymentId: string,
  ): Promise<ResolveFastSignedTransferResponse> {
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
    const latestSenderState = installedSenderApp.latestState as FastSignedTransferAppState;
    const transferAmount = latestSenderState.amount;
    const transferSigner = latestSenderState.signer;

    const [installedReceiverApp] = await this.cfCoreService.getAppInstancesByAppName(
      receiverChannel.multisigAddress,
      FastSignedTransferAppName,
    );

    let installedAppInstanceId: string;

    let needsInstall: boolean = true;
    // install if needed
    if (installedReceiverApp) {
      const latestReceiverState = installedReceiverApp.latestState as FastSignedTransferAppState;
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
    } as FastSignedTransferAppAction;

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
      const depositReceipt = await this.channelService.rebalance(
        channel.userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
        transferAmount,
      );
      if (!depositReceipt) {
        throw new Error(`Could not deposit sufficient collateral to install fast transfer app for channel: ${channel.multisigAddress}`);
      }
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(
        channel.userPublicIdentifier,
        assetId,
        RebalanceType.COLLATERALIZE,
      );
    }

    const initialState: FastSignedTransferAppState = {
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
      AddressZero,
      Zero,
      AddressZero,
      FastSignedTransferAppName,
    );

    return receiverAppInstallRes.appInstanceId;
  }
}
