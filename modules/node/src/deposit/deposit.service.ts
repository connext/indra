import { DEPOSIT_STATE_TIMEOUT } from "@connext/apps";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts";
import {
  Address,
  BigNumber,
  Contract,
  DepositAppName,
  DepositAppState,
  MinimalTransaction,
  TransactionReceipt,
  TransactionResponse,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, stringify } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { Zero, AddressZero } from "ethers/constants";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
import { OnchainTransactionService } from "../onchainTransactions/onchainTransaction.service";
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

  async deposit(channel: Channel, amount: BigNumber, tokenAddress: string): Promise<TransactionReceipt> {
    // don't allow deposit if user's balance refund app is installed
    const depositRegistry = await this.appRegistryRepository
      .findByNameAndNetwork(
        DepositAppName,
        (await this.configService.getEthNetwork()).chainId,
      );
    const depositApp = channel.appInstances.filter(
      app => app.appDefinition === depositRegistry.appDefinitionAddress
        && app.latestState.assetId === tokenAddress,
    )[0];
    this.log.debug(`Found deposit app: ${stringify(depositApp, 2)}`);
    if (
      depositApp && 
      depositApp.latestState.transfers[0].to === channel.userIdentifier
    ) {
      throw new Error(
        `Cannot deposit, user has deposit app installed for asset ${tokenAddress}, app: ${depositApp.identityHash}`,
      );
    }

    let appIdentityHash;
    if (!depositApp) {
      this.log.info(`Requesting deposit rights before depositing`);
      appIdentityHash = await this.requestDepositRights(channel, tokenAddress);
    }
    // deposit app for asset id with node as initiator is already installed
    // send deposit to chain
    let receipt;
    try { 
      const tx = await this.sendDepositToChain(channel, amount, tokenAddress);
      receipt = await tx.wait();
    } catch (e) {
      throw new Error(e.stack || e.message);
    } finally {
      await this.rescindDepositRights(appIdentityHash || depositApp.identityHash);
    }
    return receipt;
  }

  async requestDepositRights(
    channel: Channel,
    tokenAddress: string = AddressZero,
  ): Promise<string | undefined> {
    const appIdentityHash = await this.proposeDepositInstall(channel, tokenAddress);
    if (!appIdentityHash) {
      throw new Error(`Failed to install deposit app for ${tokenAddress} in channel ${channel.multisigAddress}`);
    }
    return appIdentityHash;
  }

  async rescindDepositRights(appIdentityHash: string): Promise<void> {
    this.log.debug(`Uninstalling deposit app`);
    await this.cfCoreService.uninstallApp(appIdentityHash);
  }

  private async sendDepositToChain(
    channel: Channel,
    amount: BigNumber,
    tokenAddress: Address,
  ): Promise<TransactionResponse> {
    // derive the proper minimal transaction for the 
    // onchain transaction service
    let tx: MinimalTransaction;
    if (tokenAddress === AddressZero) {
      tx = {
        to: channel.multisigAddress,
        value: amount,
        data: "0x",
      };
    } else {
      const token = new Contract(
        tokenAddress, 
        ERC20.abi as any, 
        this.configService.getEthProvider(),
      );
      tx = {
        to: tokenAddress,
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
    tokenAddress: string = AddressZero,
  ): Promise<string | undefined> {
    const ethProvider = this.configService.getEthProvider();

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(channel.multisigAddress, MinimumViableMultisig.abi as any, ethProvider);
    let startingTotalAmountWithdrawn: BigNumber;
    try {
      startingTotalAmountWithdrawn = await multisig.functions.totalAmountWithdrawn(tokenAddress);
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
      tokenAddress === AddressZero
        ? await ethProvider.getBalance(channel.multisigAddress)
        : await new Contract(
            tokenAddress,
            ERC20.abi as any,
            this.configService.getSigner(),
          ).functions.balanceOf(channel.multisigAddress);

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: await this.configService.getSignerAddress(),
        },
        {
          amount: Zero,
          to: getSignerAddressFromPublicIdentifier(channel.userIdentifier),
        },
      ],
      multisigAddress: channel.multisigAddress,
      assetId: tokenAddress,
      startingTotalAmountWithdrawn, 
      startingMultisigBalance,
    };

    const res = await this.cfCoreService.proposeAndWaitForInstallApp(
        channel,
        initialState,
        Zero,
        tokenAddress,
        Zero,
        tokenAddress,
        DepositAppName,
        { reason: "Node deposit" }, // meta
        DEPOSIT_STATE_TIMEOUT,
    );
    return res ? res.appIdentityHash : undefined;
  };

}
