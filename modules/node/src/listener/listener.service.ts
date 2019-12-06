import { SimpleLinkedTransferAppStateBigNumber, SupportedApplications } from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { bigNumberify } from "ethers/utils";

import { AppRegistryService } from "../appRegistry/appRegistry.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { MessagingClientProviderId } from "../constants";
import { LinkedTransferStatus } from "../transfer/transfer.entity";
import { LinkedTransferRepository } from "../transfer/transfer.repository";
import { TransferService } from "../transfer/transfer.service";
import { CLogger } from "../util";
import {
  CFCoreTypes,
  CreateChannelMessage,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  InstallMessage,
  InstallVirtualMessage,
  NodeMessageWrappedProtocolMessage,
  ProposeMessage,
  RejectInstallVirtualMessage,
  RejectProposalMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawStartedMessage,
} from "../util/cfCore";

const logger = new CLogger("ListenerService");

type CallbackStruct = {
  [index in keyof typeof CFCoreTypes.EventName]: (data: any) => Promise<any> | void;
};

function logEvent(
  event: CFCoreTypes.EventName,
  res: CFCoreTypes.NodeMessage & { data: any },
): void {
  logger.debug(
    `${event} event fired from ${res && res.from ? res.from : null}, data: ${
      res ? JSON.stringify(res.data) : "event did not have a result"
    }`,
  );
}

@Injectable()
export default class ListenerService implements OnModuleInit {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly appRegistryService: AppRegistryService,
    private readonly channelService: ChannelService,
    private readonly transferService: TransferService,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly channelRepository: ChannelRepository,
  ) {}

  // TODO: move the business logic into the respective modules?
  getEventListeners(): CallbackStruct {
    return {
      COUNTER_DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
        logEvent(CFCoreTypes.EventName.COUNTER_DEPOSIT_CONFIRMED, data);
      },
      CREATE_CHANNEL: async (data: CreateChannelMessage): Promise<void> => {
        logEvent(CFCoreTypes.EventName.CREATE_CHANNEL, data);
        this.channelService.makeAvailable(data);
      },
      DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
        logEvent(CFCoreTypes.EventName.DEPOSIT_CONFIRMED, data);

        // if it's from us, clear the in flight collateralization
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.channelService.clearCollateralizationInFlight(data.data.multisigAddress);
        }
      },
      DEPOSIT_FAILED: (data: DepositFailedMessage): void => {
        logEvent(CFCoreTypes.EventName.DEPOSIT_FAILED, data);
      },
      DEPOSIT_STARTED: (data: DepositStartedMessage): void => {
        logEvent(CFCoreTypes.EventName.DEPOSIT_STARTED, data);
      },
      INSTALL: async (data: InstallMessage): Promise<void> => {
        logEvent(CFCoreTypes.EventName.INSTALL, data);
      },
      // TODO: make cf return app instance id and app def?
      INSTALL_VIRTUAL: async (data: InstallVirtualMessage): Promise<void> => {
        logEvent(CFCoreTypes.EventName.INSTALL_VIRTUAL, data);
      },
      PROPOSE_INSTALL: async (data: ProposeMessage): Promise<void> => {
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          logger.debug(`Recieved proposal from our own node. Doing nothing.`);
        }
        logEvent(CFCoreTypes.EventName.PROPOSE_INSTALL, data);

        // TODO: better architecture
        // install if possible
        const allowedOrRejected = await this.appRegistryService.allowOrReject(data);
        if (!allowedOrRejected) {
          logger.log(`No data from appRegistryService.allowOrReject, nothing was installed.`);
          return;
        }

        const proposedAppParams = data.data;
        const initiatorXpub = data.from;

        // post-install tasks
        switch (allowedOrRejected.name) {
          case SupportedApplications.SimpleLinkedTransferApp:
            logger.debug(`Saving linked transfer`);
            const initialState = proposedAppParams.params
              .initialState as SimpleLinkedTransferAppStateBigNumber;
            await this.transferService.saveLinkedTransfer(
              initiatorXpub,
              proposedAppParams.params.initiatorDepositTokenAddress,
              bigNumberify(proposedAppParams.params.initiatorDeposit),
              proposedAppParams.appInstanceId,
              initialState.linkedHash,
              initialState.paymentId,
              proposedAppParams.params.meta,
            );
            logger.debug(`Linked transfer saved!`);
            break;
          // TODO: add something for swap app? maybe for history preserving reasons.
          case SupportedApplications.CoinBalanceRefundApp:
            const channel = await this.channelRepository.findByUserPublicIdentifier(initiatorXpub);
            if (!channel) {
              throw new Error(`Channel does not exist for ${initiatorXpub}`);
            }
            logger.debug(
              `sending acceptance message to indra.node.${this.cfCoreService.cfCore.publicIdentifier}.proposalAccepted.${channel.multisigAddress}`,
            );
            await this.messagingClient
              .emit(
                `indra.node.${this.cfCoreService.cfCore.publicIdentifier}.proposalAccepted.${channel.multisigAddress}`,
                proposedAppParams,
              )
              .toPromise();
            break;
          default:
            logger.debug(`No post-install actions configured.`);
        }
      },
      PROTOCOL_MESSAGE_EVENT: (data: NodeMessageWrappedProtocolMessage): void => {
        logEvent(CFCoreTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
      },
      REJECT_INSTALL: async (data: RejectProposalMessage): Promise<void> => {
        logEvent(CFCoreTypes.EventName.REJECT_INSTALL, data);

        const transfer = await this.linkedTransferRepository.findByReceiverAppInstanceId(
          data.data.appInstanceId,
        );
        if (!transfer) {
          logger.debug(`Transfer not found`);
          return;
        }
        transfer.status = LinkedTransferStatus.FAILED;
        await this.linkedTransferRepository.save(transfer);
      },
      REJECT_INSTALL_VIRTUAL: (data: RejectInstallVirtualMessage): void => {
        logEvent(CFCoreTypes.EventName.REJECT_INSTALL_VIRTUAL, data);
      },
      UNINSTALL: (data: UninstallMessage): void => {
        logEvent(CFCoreTypes.EventName.UNINSTALL, data);
      },
      UNINSTALL_VIRTUAL: async (data: UninstallVirtualMessage): Promise<void> => {
        logEvent(CFCoreTypes.EventName.UNINSTALL_VIRTUAL, data);
      },
      UPDATE_STATE: (data: UpdateStateMessage): void => {
        logEvent(CFCoreTypes.EventName.UPDATE_STATE, data);
      },
      WITHDRAWAL_CONFIRMED: (data: WithdrawConfirmationMessage): void => {
        logEvent(CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED, data);
      },
      WITHDRAWAL_FAILED: (data: WithdrawFailedMessage): void => {
        logEvent(CFCoreTypes.EventName.WITHDRAWAL_FAILED, data);
      },
      WITHDRAWAL_STARTED: (data: WithdrawStartedMessage): void => {
        logEvent(CFCoreTypes.EventName.WITHDRAWAL_STARTED, data);
      },
    };
  }

  onModuleInit(): void {
    Object.entries(this.getEventListeners()).forEach(
      ([event, callback]: [CFCoreTypes.EventName, () => any]): void => {
        this.cfCoreService.registerCfCoreListener(
          CFCoreTypes.EventName[event],
          callback,
          logger.cxt,
        );
      },
    );

    this.cfCoreService.registerCfCoreListener(
      CFCoreTypes.RpcMethodName.INSTALL as any,
      (data: any) => {
        const appInstance = data.result.result.appInstance;
        logger.debug(
          `Emitting CFCoreTypes.RpcMethodName.INSTALL event at subject indra.node.${
            this.cfCoreService.cfCore.publicIdentifier
          }.install.${appInstance.identityHash}: ${JSON.stringify(appInstance)}`,
        );
        this.messagingClient
          .emit(
            `indra.node.${this.cfCoreService.cfCore.publicIdentifier}.install.${appInstance.identityHash}`,
            appInstance,
          )
          .toPromise();
      },
      logger.cxt,
    );

    this.cfCoreService.registerCfCoreListener(
      CFCoreTypes.RpcMethodName.UNINSTALL as any,
      (data: any) => {
        logger.debug(
          `Emitting CFCoreTypes.RpcMethodName.UNINSTALL event: ${JSON.stringify(
            data.result.result,
          )} at subject indra.node.${this.cfCoreService.cfCore.publicIdentifier}.uninstall.${
            data.result.result.appInstanceId
          }`,
        );
        this.messagingClient
          .emit(
            `indra.node.${this.cfCoreService.cfCore.publicIdentifier}.uninstall.${data.result.result.appInstanceId}`,
            data.result.result,
          )
          .toPromise();
      },
      logger.cxt,
    );
  }
}
