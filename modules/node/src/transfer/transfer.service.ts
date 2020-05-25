import { Injectable, Inject } from "@nestjs/common";
import {
  Address,
  Bytes32,
  ConditionalTransferAppNames,
  AppStates,
  PublicResults,
  HashLockTransferAppName,
  SimpleLinkedTransferAppName,
  SimpleSignedTransferAppName,
  SimpleSignedTransferAppState,
  SimpleLinkedTransferAppState,
  HashLockTransferAppState,
  MethodParams,
} from "@connext/types";
import { stringify, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import {
  TRANSFER_TIMEOUT,
  validateHashLockTransferApp,
  SupportedApplications,
  commonAppProposalValidation,
  validateSimpleLinkedTransferApp,
  validateSignedTransferApp,
} from "@connext/apps";
import { MessagingService } from "@connext/messaging";
import { Zero, HashZero } from "ethers/constants";

import { LoggerService } from "../logger/logger.service";
import { ChannelRepository } from "../channel/channel.repository";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { DepositService } from "../deposit/deposit.service";
import { TIMEOUT_BUFFER, MessagingProviderId } from "../constants";
import { ConfigService } from "../config/config.service";
import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { Channel } from "../channel/channel.entity";

import { TransferRepository } from "./transfer.repository";

type TransferType = "RequireOnline" | "AllowOffline";
const getTransferTypeFromAppName = (name: SupportedApplications): TransferType | undefined => {
  switch (name) {
    case SupportedApplications.DepositApp:
    case SupportedApplications.SimpleTwoPartySwapApp:
    case SupportedApplications.WithdrawApp: {
      return undefined;
    }
    case SupportedApplications.HashLockTransferApp: {
      return "RequireOnline";
    }
    case SupportedApplications.SimpleLinkedTransferApp:
    case SupportedApplications.SimpleSignedTransferApp: {
      return "AllowOffline";
    }
    default:
      const c: never = name;
      throw new Error(`Unreachable: ${c}`);
  }
};

@Injectable()
export class TransferService {
  constructor(
    private readonly log: LoggerService,
    private readonly configService: ConfigService,
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly depositService: DepositService,
    private readonly transferRepository: TransferRepository,
    private readonly channelRepository: ChannelRepository,
  ) {
    this.log.setContext("TransferService");
  }

  async transferAppInstallFlow(
    appIdentityHash: string,
    registryAppInfo: AppRegistry,
    proposeInstallParams: MethodParams.ProposeInstall,
    from: string,
    installerChannel: Channel,
    transferType: ConditionalTransferAppNames,
  ): Promise<void> {
    this.log.info(
      `Start transferAppInstallFlow with params ${stringify({
        appIdentityHash,
        registryAppInfo,
        proposeInstallParams,
        from,
        installerChannel,
        transferType,
      })}`,
    );
    const supportedAddresses = this.configService.getSupportedTokenAddresses();

    try {
      this.log.debug(`Start commonAppProposalValidation`);
      commonAppProposalValidation(proposeInstallParams, registryAppInfo, supportedAddresses);
      this.log.debug(`Finish commonAppProposalValidation`);

      switch (transferType) {
        case ConditionalTransferAppNames.HashLockTransferApp: {
          const blockNumber = await this.configService.getEthProvider().getBlockNumber();
          this.log.debug(`Start validateHashLockTransferApp`);
          validateHashLockTransferApp(
            proposeInstallParams,
            blockNumber,
            from,
            this.cfCoreService.cfCore.publicIdentifier,
          );
          this.log.debug(`Finish validateHashLockTransferApp`);
          break;
        }
        case ConditionalTransferAppNames.SimpleLinkedTransferApp: {
          this.log.debug(`Start validateSimpleLinkedTransferApp`);
          validateSimpleLinkedTransferApp(
            proposeInstallParams,
            from,
            this.cfCoreService.cfCore.publicIdentifier,
          );
          this.log.debug(`Finish validateSimpleLinkedTransferApp`);
          break;
        }
        case ConditionalTransferAppNames.SimpleSignedTransferApp: {
          this.log.debug(`Start validateSignedTransferApp`);
          validateSignedTransferApp(
            proposeInstallParams,
            from,
            this.cfCoreService.cfCore.publicIdentifier,
          );
          this.log.debug(`Finish validateSignedTransferApp`);
          break;
        }
        default: {
          const c: never = transferType;
          throw new Error(`Unreachable: ${c}`);
        }
      }

      // install for receiver or error
      // https://github.com/ConnextProject/indra/issues/942
      const paymentId = proposeInstallParams.meta.paymentId;
      try {
        this.log.info(`Start installReceiverAppByPaymentId for paymentId ${paymentId}`);
        await this.installReceiverAppByPaymentId(
          from,
          proposeInstallParams.meta["recipient"],
          paymentId,
          proposeInstallParams.initiatorDepositAssetId,
          proposeInstallParams.initialState as AppStates[typeof transferType],
          proposeInstallParams.meta,
          transferType,
        );
        this.log.info(`Finish installReceiverAppByPaymentId for paymentId ${paymentId}`);
      } catch (e) {
        this.log.error(`Caught error in transferAppInstallFlow: ${e.message}`);
        const allowed = getTransferTypeFromAppName(transferType);
        if (allowed === "RequireOnline") {
          throw e;
        }
      }

      this.log.info(`Start install sender app for paymentId ${paymentId}`);
      const { appInstance } = await this.cfCoreService.installApp(
        appIdentityHash,
        installerChannel.multisigAddress,
      );
      this.log.info(`Finish install sender app for paymentId ${paymentId}`);

      const installSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${installerChannel.multisigAddress}.app-instance.${appIdentityHash}.install`;
      await this.messagingService.publish(installSubject, appInstance);
    } catch (e) {
      // reject if error
      this.log.warn(`App install failed: ${e.stack || e.message}`);
      await this.cfCoreService.rejectInstallApp(appIdentityHash, installerChannel.multisigAddress);
      return;
    }
  }

  async installReceiverAppByPaymentId(
    senderIdentifier: string,
    receiverIdentifier: Address,
    paymentId: Bytes32,
    assetId: Address,
    senderAppState: AppStates[ConditionalTransferAppNames],
    meta: any = {},
    transferType: ConditionalTransferAppNames,
  ): Promise<PublicResults.ResolveCondition> {
    this.log.info(
      `installReceiverAppByPaymentId for ${receiverIdentifier} paymentId ${paymentId} started`,
    );
    const receiverChannel = await this.channelRepository.findByUserPublicIdentifierOrThrow(
      receiverIdentifier,
    );

    // sender amount
    const amount = senderAppState.coinTransfers[0].amount;

    const existing = await this.findReceiverAppByPaymentId(paymentId);
    if (existing) {
      const result: PublicResults.ResolveCondition = {
        appIdentityHash: existing.identityHash,
        sender: senderIdentifier,
        paymentId,
        meta,
        amount,
        assetId,
      };
      switch (existing.type) {
        case AppType.INSTANCE: {
          this.log.warn(`Found existing transfer app, returning: ${stringify(result)}`);
          return result;
        }
        case AppType.PROPOSAL: {
          this.log.warn(
            `Found existing transfer app proposal ${existing.identityHash}, rejecting and continuing`,
          );
          await this.cfCoreService.rejectInstallApp(
            existing.identityHash,
            receiverChannel.multisigAddress,
          );
          break;
        }
        default: {
          this.log.warn(
            `Found existing app with payment id with incorrect type: ${existing.type}, proceeding to propose new app`,
          );
        }
      }
    }

    const freeBalanceAddr = this.cfCoreService.cfCore.signerAddress;

    const freeBal = await this.cfCoreService.getFreeBalance(
      receiverIdentifier,
      receiverChannel.multisigAddress,
      assetId,
    );

    if (freeBal[freeBalanceAddr].lt(amount)) {
      // request collateral and wait for deposit to come through
      this.log.warn(
        `Collateralizing ${receiverIdentifier} before proceeding with signed transfer payment`,
      );
      const deposit = await this.channelService.getCollateralAmountToCoverPaymentAndRebalance(
        receiverIdentifier,
        assetId,
        amount,
        freeBal[freeBalanceAddr],
      );
      // request collateral and wait for deposit to come through
      const depositReceipt = await this.depositService.deposit(receiverChannel, deposit, assetId);
      if (!depositReceipt) {
        throw new Error(
          `Could not deposit sufficient collateral to resolve linked transfer for receiver: ${receiverIdentifier}`,
        );
      }
    }

    const baseInitialState: Partial<AppStates[typeof transferType]> = {
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddr,
        },
        {
          amount: Zero,
          to: getSignerAddressFromPublicIdentifier(receiverIdentifier),
        },
      ],
      paymentId,
    };

    let initialState: AppStates[typeof transferType];
    switch (transferType) {
      case HashLockTransferAppName: {
        const expiry = (senderAppState as HashLockTransferAppState).expiry.sub(TIMEOUT_BUFFER);
        const provider = this.configService.getEthProvider();
        const currBlock = await provider.getBlockNumber();
        if (expiry.lt(currBlock)) {
          throw new Error(
            `Cannot resolve hash lock transfer with expired expiry: ${expiry.toString()}, block: ${currBlock}`,
          );
        }
        initialState = {
          ...baseInitialState,
          lockHash: (senderAppState as HashLockTransferAppState).lockHash,
          preImage: HashZero,
          expiry,
          finalized: false,
        } as HashLockTransferAppState;
        break;
      }
      case SimpleLinkedTransferAppName: {
        initialState = {
          ...baseInitialState,
          amount,
          assetId,
          linkedHash: (senderAppState as SimpleLinkedTransferAppState).linkedHash,
          paymentId,
          preImage: HashZero,
        } as SimpleLinkedTransferAppState;
        break;
      }
      case SimpleSignedTransferAppName: {
        initialState = {
          ...baseInitialState,
          finalized: false,
          signer: (senderAppState as SimpleSignedTransferAppState).signer,
        } as SimpleSignedTransferAppState;
        break;
      }
      default:
        const c: never = transferType;
        throw new Error(`Unreachable: ${c}`);
    }

    const receiverAppInstallRes = await this.cfCoreService.proposeAndWaitForInstallApp(
      receiverChannel,
      initialState,
      amount,
      assetId,
      Zero,
      assetId,
      transferType,
      meta,
      TRANSFER_TIMEOUT,
    );

    if (!receiverAppInstallRes || !receiverAppInstallRes.appIdentityHash) {
      throw new Error(`Could not install app on receiver side.`);
    }

    const result: PublicResults.ResolveCondition = {
      appIdentityHash: receiverAppInstallRes.appIdentityHash,
      paymentId,
      sender: senderIdentifier,
      meta,
      amount,
      assetId,
    };

    this.log.info(
      `installReceiverAppByPaymentId for ${receiverIdentifier} paymentId ${paymentId} complete: ${JSON.stringify(
        result,
      )}`,
    );
    return result;
  }

  async resolveByPaymentId(
    receiverIdentifier: string,
    paymentId: string,
    transferType: ConditionalTransferAppNames,
  ): Promise<PublicResults.ResolveCondition> {
    const senderApp = await this.findSenderAppByPaymentId(paymentId);
    if (!senderApp || senderApp.type !== AppType.INSTANCE) {
      throw new Error(`Sender app is not installed for paymentId ${paymentId}`);
    }

    const latestState = senderApp.latestState as SimpleLinkedTransferAppState;
    if (latestState.preImage && latestState.preImage !== HashZero) {
      throw new Error(`Sender app has action, refusing to redeem`);
    }

    return this.installReceiverAppByPaymentId(
      senderApp.userIdentifier,
      receiverIdentifier,
      paymentId,
      senderApp.initiatorDepositAssetId,
      latestState,
      senderApp.meta,
      transferType,
    );
  }

  async findSenderAppByPaymentId(paymentId: string): Promise<AppInstance> {
    this.log.info(`findSenderAppByPaymentId ${paymentId} started`);
    // node receives from sender
    const app = await this.transferRepository.findTransferAppByPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    this.log.info(`findSenderAppByPaymentId ${paymentId} completed: ${JSON.stringify(app)}`);
    return app;
  }

  async findReceiverAppByPaymentId(paymentId: string): Promise<AppInstance> {
    this.log.info(`findReceiverAppByPaymentId ${paymentId} started`);
    // node sends to receiver
    const app = await this.transferRepository.findTransferAppByPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
    );
    this.log.info(`findReceiverAppByPaymentId ${paymentId} completed: ${JSON.stringify(app)}`);
    return app;
  }
}
