import {
  DepositConfirmationMessage,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DepositFailedMessage,
  HashLockTransferAppState,
  HashLockTransferAppStateBigNumber,
  HashLockTransferApp,
  ResolveHashLockTransferResponseBigNumber,
} from "@connext/types";
import { convertHashLockTransferAppState } from "@connext/apps";
import { Injectable } from "@nestjs/common";
import { HashZero, Zero } from "ethers/constants";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { xpubToAddress } from "../util";

@Injectable()
export class HashLockTransferService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly log: LoggerService,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("LinkedTransferService");
  }

  async resolveHashLockTransfer(
    userPubId: string,
    lockHash: string,
  ): Promise<ResolveHashLockTransferResponseBigNumber> {
    this.log.debug(`resolveLinkedTransfer(${userPubId}, ${lockHash})`);
    const channel = await this.channelRepository.findByUserPublicIdentifierOrThrow(userPubId);

    // TODO: could there be more than 1? how to handle that case?
    const [senderApp] = await this.cfCoreService.getHashLockTransferAppByLockHash(lockHash);
    const senderChannel = await this.channelRepository.findByMultisigAddressOrThrow(
      senderApp.multisigAddress,
    );

    const appState = convertHashLockTransferAppState(
      "bignumber",
      senderApp.latestState as HashLockTransferAppState,
    );

    const assetId = senderApp.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress;

    // sender amount
    const amount = appState.coinTransfers[0].amount;

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

    const initialState: HashLockTransferAppStateBigNumber = {
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: xpubToAddress(userPubId),
        },
      ],
      lockHash,
      preImage: HashZero,
      turnNum: Zero,
      finalized: false,
    };

    console.log("START INSTALLING RECEIVER APP");
    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      userPubId,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      HashLockTransferApp,
    );
    console.log("receiverAppInstallRes: ", receiverAppInstallRes);

    if (!receiverAppInstallRes || !receiverAppInstallRes.appInstanceId) {
      throw new Error(`Could not install app on receiver side.`);
    }

    return {
      appId: receiverAppInstallRes.appInstanceId,
      sender: senderChannel.userPublicIdentifier,
      meta: {},
      amount,
      assetId,
    };
  }
}
