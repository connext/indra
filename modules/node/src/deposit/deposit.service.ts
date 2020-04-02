import {
  BigNumber,
  MinimalTransaction,
  Contract,
  DepositAppState,
  DepositAppName,
  TransactionResponse,
  TransactionReceipt,
} from "@connext/types";
import { MinimumViableMultisig } from "@connext/contracts";
import { Injectable } from "@nestjs/common";
import { Zero, AddressZero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { CFCoreService } from "../cfCore/cfCore.service";
import { Channel } from "../channel/channel.entity";
import { ConfigService } from "../config/config.service";
import { LoggerService } from "../logger/logger.service";
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
  ) {
    this.log.setContext("DepositService");
  }

  async deposit(channel: Channel, amount: BigNumber, assetId: string): Promise<TransactionReceipt> {
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

    let appInstanceId;
    if (!depositApp) {
        this.log.info(`Requesting deposit rights before depositing`);
        appInstanceId = await this.requestDepositRights(channel, assetId);
        if(!appInstanceId) this.log.error(`Failed to install deposit app!`);
    }
    const tx = await this.sendDepositToChain(channel, amount, assetId);
    const receipt = await tx.wait();
    await this.rescindDepositRights(appInstanceId);
    return receipt;
  }

  async requestDepositRights(channel: Channel, assetIdParam: string): Promise<string | undefined> {
    let assetId = assetIdParam ? assetIdParam : AddressZero;
    const appInstanceId = await this.proposeDepositInstall(channel, assetId);
    return appInstanceId;
  }

  async rescindDepositRights(appInstanceId: string): Promise<void> {
    this.log.debug(`Uninstalling deposit app`);
    await this.cfCoreService.uninstallApp(appInstanceId);
  }

  async getDepositApp(channel: Channel, assetId: string): Promise<any> {
    return channel.appInstances.filter((appInstance) => {
      appInstance.initiatorDepositTokenAddress === assetId;
    })[0];
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
    const startingTotalAmountWithdrawn = multisig
    ? await multisig.functions.totalAmountWithdrawn(assetId)
    : Zero;

    // generate starting multisig balance
    const startingMultisigBalance =
      assetId === AddressZero
        ? await ethProvider.getBalance(channel.multisigAddress)
        : await token.functions.balanceOf(channel.multisigAddress);

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: xkeyKthAddress(channel.userPublicIdentifier),
        },
        {
          amount: Zero,
          to: xkeyKthAddress(this.configService.getPublicIdentifier()),
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