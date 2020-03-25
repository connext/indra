import {
  DepositConfirmationMessage,
  DepositFailedMessage,
  EventNames,
  HashLockTransferAppName,
  HashLockTransferAppState,
  HashLockTransferStatus,
  ResolveHashLockTransferResponse,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { xkeyKthAddress } from "../util";
import { TIMEOUT_BUFFER } from "../constants";
import { ConfigService } from "../config/config.service";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

const appStatusesToHashLockTransferStatus = (
  currentBlockNumber: number,
  senderApp: AppInstance,
  receiverApp?: AppInstance,
): HashLockTransferStatus | undefined => {
  if (!senderApp) {
    return undefined;
  }
  const { timelock: senderTimelock } = senderApp.latestState as HashLockTransferAppState;
  const isSenderExpired = bigNumberify(senderTimelock).lt(currentBlockNumber);
  const isReceiverExpired =
    receiverApp &&
    bigNumberify((receiverApp.latestState as HashLockTransferAppState).timelock).lt(
      currentBlockNumber,
    );
  // pending iff no receiver app + not expired
  if (!receiverApp) {
    return isSenderExpired ? HashLockTransferStatus.EXPIRED : HashLockTransferStatus.PENDING;
  } else if (senderApp.type === AppType.UNINSTALLED) {
    // iff sender uninstalled, payment is unlocked
    return HashLockTransferStatus.UNLOCKED;
  } else if (receiverApp.type === AppType.UNINSTALLED) {
    // otherwise check for reclaim
    return HashLockTransferStatus.REDEEMED;
  } else if (senderApp.type === AppType.REJECTED || receiverApp.type === AppType.REJECTED) {
    return HashLockTransferStatus.FAILED;
  } else if (isReceiverExpired && receiverApp.type === AppType.INSTANCE) {
    // iff there is a receiver app, check for expiry
    // do this last bc could be retrieving historically
    return HashLockTransferStatus.EXPIRED;
  } else {
    throw new Error(`Cound not determine hash lock trasnfer status`);
  }
};

@Injectable()
export class HashLockTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("HashLockTransferService");
  }

  async resolveHashLockTransfer(
    userPubId: string,
    lockHash: string,
  ): Promise<ResolveHashLockTransferResponse> {
    this.log.debug(`resolveLinkedTransfer(${userPubId}, ${lockHash})`);
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(userPubId);

    // TODO: could there be more than 1? how to handle that case?
    const [senderApp] = await this.cfCoreService.getHashLockTransferAppsByLockHash(lockHash);
    if (!senderApp) {
      throw new Error(`No sender app installed for lockHash: ${lockHash}`);
    }
    this.log.warn(`***** senderApp: ${JSON.stringify(senderApp, null, 2)}`);

    const senderChannel = await this.channelRepository.findByMultisigAddressOrThrow(
      senderApp.multisigAddress,
    );

    const appState = senderApp.latestState as HashLockTransferAppState;

    const assetId = senderApp.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;

    // sender amount
    const amount = appState.coinTransfers[0].amount;
    this.log.warn(`***** amount: ${amount.toString()}`);
    const timelock = appState.timelock.sub(TIMEOUT_BUFFER);
    if (timelock.lte(Zero)) {
      throw new Error(
        `Cannot resolve hash lock transfer with 0 or negative timelock: ${timelock.toString()}`,
      );
    }
    const provider = this.configService.getEthProvider();
    const currBlock = await provider.getBlockNumber();
    if (timelock.lt(currBlock)) {
      throw new Error(
        `Cannot resolve hash lock transfer with expired timelock: ${timelock.toString()}, block: ${currBlock}`,
      );
    }

    const freeBalanceAddr = this.cfCoreService.cfCore.freeBalanceAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );
    if (freeBal[freeBalanceAddr].lt(amount)) {
      // request collateral and wait for deposit to come through
      // TODO: expose remove listener
      await new Promise(async (resolve, reject) => {
        this.cfCoreService.cfCore.on(
          EventNames.DEPOSIT_CONFIRMED_EVENT,
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
            resolve();
          },
        );
        this.cfCoreService.cfCore.on(
          EventNames.DEPOSIT_FAILED_EVENT,
          (msg: DepositFailedMessage) => {
            return reject(JSON.stringify(msg, null, 2));
          },
        );
        try {
          await this.channelService.rebalance(
            userPubId,
            assetId,
            RebalanceType.COLLATERALIZE,
            amount,
          );
        } catch (e) {
          return reject(e);
        }
      });
    } else {
      // request collateral normally without awaiting
      this.channelService.rebalance(userPubId, assetId, RebalanceType.COLLATERALIZE, amount);
    }

    const initialState: HashLockTransferAppState = {
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: xkeyKthAddress(userPubId),
        },
      ],
      lockHash,
      preImage: HashZero,
      timelock,
      finalized: false,
    };

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      channel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      HashLockTransferAppName,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appInstanceId) {
      throw new Error(`Could not install app on receiver side.`);
    }

    return {
      appId: receiverAppInstallRes.appInstanceId,
      sender: senderChannel.userPublicIdentifier,
      meta: senderApp["meta"] || {},
      amount,
      assetId,
    };
  }

  async findSenderAndReceiverAppsWithStatus(
    lockHash: string,
  ): Promise<{ senderApp: AppInstance; receiverApp: AppInstance; status: any } | undefined> {
    // TODO: can we make single query work?
    const [
      senderApp,
      receiverApp,
    ] = await this.appInstanceRepository.findHashLockTransferAppsByLockHash(lockHash);
    // const senderApp = await this.appInstanceRepository.findHashLockTransferAppsByLockHashAndSender(
    //   lockHash,
    //   this.cfCoreService.cfCore.freeBalanceAddress,
    // );
    // const lockHash = await this.appInstanceRepository.findHashLockTransferAppsByLockHashAndRecipient(
    //   lockHash,
    //   this.cfCoreService.cfCore.freeBalanceAddress,
    // );
    // get status
    const block = await this.configService.getEthProvider().getBlockNumber();
    const status = appStatusesToHashLockTransferStatus(block, senderApp, receiverApp);
    this.log.warn(`***** got status: ${status}`);
    return { senderApp, receiverApp, status };
  }
}
