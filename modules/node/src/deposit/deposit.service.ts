import { signDigest } from "@connext/crypto";
import {
  AppInstanceJson,
  BigNumber,
  CoinTransfer,
  MinimalTransaction,
  stringify,
  TransactionResponse,
  toBN,
  Contract,
  CheckDepositRightsResponse,
  DepositAppState,
  DepositAppName,
  MethodParams,
  AppInstanceInfo,
  ABIEncoding,
  AppABIEncodings
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero, AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ChannelRepository } from "../channel/channel.repository";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { xkeyKthAddress } from "../util";
import { AppInstance } from "@connext/cf-core/dist/models";

@Injectable()
export class DepositService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly configService: ConfigService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly log: LoggerService,
    private readonly onchainTransactionRepository: OnchainTransactionRepository,
    private readonly withdrawRepository: WithdrawRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("ChannelService");
  }

  async deposit(channel: Channel, amount: BigNumber, assetId: string ): Promise<void> {
    // don't allow deposit if user's balance refund app is installed
    const depositApp: AppInstance = await this.getDepositApp(
        channel,
        assetId,
    );
    if (
        depositApp &&
        depositApp.latestState.transfers[0].to === xkeyKthAddress(channel.userPublicIdentifier)
    ) {
        throw new Error(
            `Cannot deposit, user's depositApp ${channel.userPublicIdentifier}, assetId: ${assetId}`,
        );
    }

    let appInstanceId, multisigAddress
    if (!depositApp) {
        this.log.info(`Requesting deposit rights before depositing`);
        appInstanceId = await this.requestDepositRights(channel, assetId)
    }
    await this.sendDepositToChain(channel, amount, assetId);
    return this.rescindDepositRights(appInstanceId);
  }

  async requestDepositRights(channel: Channel, assetIdParam: string): Promise<string> {
    let assetId = assetIdParam ? assetIdParam : AddressZero;
    const appInstanceId = await this.proposeDepositInstall(assetId)
    return appInstanceId;
  }

  async rescindDepositRights(appInstanceId: string): Promise<void> {
    this.log.debug(`Uninstalling deposit app`)
    await this.cfCoreService.uninstallApp(appInstanceId);
  }

  async getDepositApp(channel: Channel, assetId: string): Promise<any> {
    return channel.appInstances.filter((appInstance) => {
      appInstance.initiatorDepositTokenAddress == assetId
    })[0];
  }

  private async sendDepositToChain(
      channel: Channel,
      amount: BigNumber,
      assetId: string
  ): Promise<void> {
    //TODO
    const depositTx = await this.configService.getEthProvider().getTransaction(res.transactionHash);
    await this.onchainTransactionRepository.addCollateralization(depositTx, channel);
  }

  private async proposeDepositInstall (
    assetId: string,
  ): Promise<string> {
    const token = new Contract(assetId!, tokenAbi, this.ethProvider);

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(this.connext.multisigAddress, MinimumViableMultisig.abi, this.ethProvider);
    const startingTotalAmountWithdrawn = multisig
    ? await multisig.functions.totalAmountWithdrawn(assetId)
    : Zero;

    // generate starting multisig balance
    const startingMultisigBalance =
      assetId === AddressZero
        ? await this.ethProvider.getBalance(this.connext.multisigAddress)
        : await token.functions.balanceOf(this.connext.multisigAddress);

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: this.connext.freeBalanceAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeFreeBalanceAddress,
        },
      ],
      multisigAddress: this.connext.multisigAddress,
      assetId,
      startingTotalAmountWithdrawn, 
      startingMultisigBalance
    }

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(DepositAppName);

    const params: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const appId = await this.proposeAndInstallLedgerApp(params);
    return appId;
  };

}