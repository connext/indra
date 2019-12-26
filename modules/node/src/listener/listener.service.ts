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
  [index in CFCoreTypes.EventName]: (data: any) => Promise<any> | void;
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

  getEventListeners(): CallbackStruct {
    return {
      CREATE_CHANNEL_EVENT: async (data: CreateChannelMessage): Promise<void> => {
        logEvent("CREATE_CHANNEL_EVENT", data);
        this.channelService.makeAvailable(data);
      },
      DEPOSIT_CONFIRMED_EVENT: (data: DepositConfirmationMessage): void => {
        logEvent("DEPOSIT_CONFIRMED_EVENT", data);

        // if it's from us, clear the in flight collateralization
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.channelService.clearCollateralizationInFlight(data.data.multisigAddress);
        }
      },
      DEPOSIT_FAILED_EVENT: (data: DepositFailedMessage): void => {
        logEvent("DEPOSIT_FAILED_EVENT", data);
      },
      DEPOSIT_STARTED_EVENT: (data: DepositStartedMessage): void => {
        logEvent("DEPOSIT_STARTED_EVENT", data);
      },
      INSTALL_EVENT: async (data: InstallMessage): Promise<void> => {
        logEvent("INSTALL_EVENT", data);
      },
      // TODO: make cf return app instance id and app def?
      INSTALL_VIRTUAL_EVENT: async (data: InstallVirtualMessage): Promise<void> => {
        logEvent("INSTALL_VIRTUAL_EVENT", data);
      },
      PROPOSE_INSTALL_EVENT: async (data: ProposeMessage): Promise<void> => {
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          logger.debug(`Recieved proposal from our own node. Doing nothing.`);
        }
        logEvent("PROPOSE_INSTALL_EVENT", data);

        // TODO: separate install from validation, do both at this level
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
        logEvent("PROTOCOL_MESSAGE_EVENT", data);
      },
      REJECT_INSTALL_EVENT: async (data: RejectProposalMessage): Promise<void> => {
        logEvent("REJECT_INSTALL_EVENT", data);

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
      UNINSTALL_EVENT: (data: UninstallMessage): void => {
        logEvent("UNINSTALL_EVENT", data);
      },
      UNINSTALL_VIRTUAL_EVENT: async (data: UninstallVirtualMessage): Promise<void> => {
        logEvent("UNINSTALL_VIRTUAL_EVENT", data);
      },
      UPDATE_STATE_EVENT: (data: UpdateStateMessage): void => {
        logEvent("UPDATE_STATE_EVENT", data);
      },
      WITHDRAWAL_CONFIRMED_EVENT: (data: WithdrawConfirmationMessage): void => {
        logEvent("WITHDRAWAL_CONFIRMED_EVENT", data);
      },
      WITHDRAWAL_FAILED_EVENT: (data: WithdrawFailedMessage): void => {
        logEvent("WITHDRAWAL_FAILED_EVENT", data);
      },
      WITHDRAWAL_STARTED_EVENT: (data: WithdrawStartedMessage): void => {
        logEvent("WITHDRAWAL_STARTED_EVENT", data);
      },
    };
  }

  onModuleInit(): void {
    Object.entries(this.getEventListeners()).forEach(
      ([event, callback]: [CFCoreTypes.EventName, () => any]): void => {
        this.cfCoreService.registerCfCoreListener(
          CFCoreTypes.EventNames[event] as CFCoreTypes.EventName,
          callback,
          logger.cxt,
        );
      },
    );

    this.cfCoreService.registerCfCoreListener(
      CFCoreTypes.RpcMethodNames.chan_install as any,
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
      CFCoreTypes.RpcMethodNames.chan_uninstall as any,
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
