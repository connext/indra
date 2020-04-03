import { MinimumViableMultisig } from "@connext/contracts";
import {
  BigNumber,
  MinimalTransaction,
  Contract,
  DepositAppState,
  DepositAppName,
  TransactionResponse,
  TransactionReceipt,
  stringify,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { Zero, AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
import { xkeyKthAddress } from "../util";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";

@Injectable()
export class DepositService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly configService: ConfigService,
    private readonly onchainTransactionService: OnchainTransactionService,
    private readonly log: LoggerService,
    private readonly appRegistryRepository: AppRegistryRepository,
  ) {
    this.log.setContext("DepositService");
  }

  async deposit(channel: Channel, amount: BigNumber, assetId: string): Promise<TransactionReceipt> {
    // don't allow deposit if user's balance refund app is installed
    const depositRegistry = await this.appRegistryRepository
      .findByNameAndNetwork(
        DepositAppName,
        (await this.configService.getEthNetwork()).chainId,
      );
    const depositApp = channel.appInstances.filter(
      app => app.appDefinition === depositRegistry.appDefinitionAddress
        && app.latestState.assetId === assetId,
    )[0];
    this.log.debug(`Found deposit app: ${stringify(depositApp, 2)}`);
    if (
      depositApp && 
      depositApp.latestState.transfers[0].to === xkeyKthAddress(channel.userPublicIdentifier)
    ) {
      throw new Error(
        `Cannot deposit, user has deposit app installed for asset ${assetId}, app: ${depositApp.identityHash}`,
      );
    }

    let appInstanceId;
    if (!depositApp) {
      this.log.info(`Requesting deposit rights before depositing`);
      appInstanceId = await this.requestDepositRights(channel, assetId);
    }
    // deposit app for asset id with node as initiator is already installed
    // send deposit to chain
    const tx = await this.sendDepositToChain(channel, amount, assetId);
    const receipt = await tx.wait();
    await this.rescindDepositRights(appInstanceId || depositApp.identityHash);
    return receipt;
  }

  async requestDepositRights(channel: Channel, assetIdParam: string): Promise<string | undefined> {
    const assetId = assetIdParam || AddressZero;
    const appInstanceId = await this.proposeDepositInstall(channel, assetId);
    if (!appInstanceId) {
      throw new Error(`Failed to install deposit app for ${assetId} in channel ${channel.multisigAddress}`);
    }
    return appInstanceId;
  }

  async rescindDepositRights(appInstanceId: string): Promise<void> {
    this.log.debug(`Uninstalling deposit app`);
    await this.cfCoreService.uninstallApp(appInstanceId);
  }

  private async sendDepositToChain(
      channel: Channel,
      amount: BigNumber,
      assetId: string,
  ): Promise<TransactionResponse> {
    // derive the proper minimal transaction for the 
    // onchain transaction service
    let tx: MinimalTransaction;
    if (assetId === AddressZero) {
      tx = {
        to: channel.multisigAddress,
        value: amount,
        data: "0x",
      };
    } else {
      const token = new Contract(assetId, tokenAbi, this.configService.getEthProvider());
      tx = {
        to: token.address,
        value: 0,
        data: await token.interface.functions.transfer.encode([
          channel.multisigAddress,
          amount,
        ]),
      };
    }
    return this.onchainTransactionService.sendDeposit(channel, tx);
  }

  private async proposeDepositInstall (
    channel: Channel,
    assetId: string,
  ): Promise<string | undefined> {
    const ethProvider = this.configService.getEthProvider();
    const token = new Contract(assetId!, tokenAbi, ethProvider);

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(channel.multisigAddress, MinimumViableMultisig.abi, ethProvider);
    let startingTotalAmountWithdrawn: BigNumber;
    try {
      startingTotalAmountWithdrawn = await multisig.functions.totalAmountWithdrawn(assetId);
    } catch (e) {
      const NOT_DEPLOYED_ERR = `contract not deployed (contractAddress="${channel.multisigAddress}"`;
      if (!e.message.includes(NOT_DEPLOYED_ERR)) {
        throw new Error(e);
      }
      // multisig is deployed on withdrawal, if not
      // deployed withdrawal amount is 0
      startingTotalAmountWithdrawn = Zero;
    }

    // generate starting multisig balance
    const startingMultisigBalance =
      assetId === AddressZero
        ? await ethProvider.getBalance(channel.multisigAddress)
        : await token.functions.balanceOf(channel.multisigAddress);

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: xkeyKthAddress(this.configService.getPublicIdentifier()),
        },
        {
          amount: Zero,
          to: xkeyKthAddress(channel.userPublicIdentifier),
        },
      ],
      multisigAddress: channel.multisigAddress,
      assetId,
      startingTotalAmountWithdrawn, 
      startingMultisigBalance,
    };

    const res = await this.cfCoreService.proposeAndWaitForInstallApp(
        channel,
        initialState,
        Zero,
        assetId,
        Zero,
        assetId,
        DepositAppName,
    );
    return res ? res.appInstanceId : undefined;
  };

}