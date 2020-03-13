import {
  CREATE_CHANNEL_EVENT,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DEPOSIT_STARTED_EVENT,
  INSTALL_EVENT,
  PROPOSE_INSTALL_EVENT,
  PROTOCOL_MESSAGE_EVENT,
  REJECT_INSTALL_EVENT,
  UNINSTALL_EVENT,
  UPDATE_STATE_EVENT,
  WITHDRAWAL_CONFIRMED_EVENT,
  WITHDRAWAL_FAILED_EVENT,
  WITHDRAWAL_STARTED_EVENT,
  ProtocolTypes,
} from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

import { AppRegistryService } from "../appRegistry/appRegistry.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingClientProviderId } from "../constants";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import {
  CFCoreTypes,
  CreateChannelMessage,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  InstallMessage,
  NodeMessageWrappedProtocolMessage,
  ProposeMessage,
  RejectProposalMessage,
  UninstallMessage,
  UpdateStateMessage,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawStartedMessage,
} from "../util/cfCore";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { LinkedTransferRepository } from "../linkedTransfer/linkedTransfer.repository";
import { LinkedTransferStatus } from "../linkedTransfer/linkedTransfer.entity";
import { AppActionsService } from "../appRegistry/appActions.service";

type CallbackStruct = {
  [index in CFCoreTypes.EventName]: (data: any) => Promise<any> | void;
};

@Injectable()
export default class ListenerService implements OnModuleInit {
  constructor(
    private readonly appRegistryService: AppRegistryService,
    private readonly appActionsService: AppActionsService,
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly linkedTransferService: LinkedTransferService,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly log: LoggerService,
    @Inject(MessagingClientProviderId) private readonly messagingClient: ClientProxy,
  ) {
    this.log.setContext("ListenerService");
  }

  logEvent(event: CFCoreTypes.EventName, res: CFCoreTypes.NodeMessage & { data: any }): void {
    this.log.debug(
      `${event} event fired from ${res && res.from ? res.from : null}, data: ${
        res ? JSON.stringify(res.data) : `event did not have a result`
      }`,
    );
  }

  getEventListeners(): CallbackStruct {
    return {
      CREATE_CHANNEL_EVENT: async (data: CreateChannelMessage): Promise<void> => {
        this.logEvent(CREATE_CHANNEL_EVENT, data);
        this.channelService.makeAvailable(data);
      },
      DEPOSIT_CONFIRMED_EVENT: (data: DepositConfirmationMessage): void => {
        this.logEvent(DEPOSIT_CONFIRMED_EVENT, data);

        // if it's from us, clear the in flight collateralization
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.channelService.clearCollateralizationInFlight(data.data.multisigAddress);
        }
      },
      DEPOSIT_FAILED_EVENT: (data: DepositFailedMessage): void => {
        this.logEvent(DEPOSIT_FAILED_EVENT, data);
      },
      DEPOSIT_STARTED_EVENT: (data: DepositStartedMessage): void => {
        this.logEvent(DEPOSIT_STARTED_EVENT, data);
      },
      INSTALL_EVENT: async (data: InstallMessage): Promise<void> => {
        this.logEvent(INSTALL_EVENT, data);
      },
      PROPOSE_INSTALL_EVENT: (data: ProposeMessage): void => {
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.log.debug(`Received proposal from our own node. Doing nothing.`);
          return;
        }
        this.logEvent(PROPOSE_INSTALL_EVENT, data);
        this.appRegistryService.validateAndInstallOrReject(
          data.data.appInstanceId,
          data.data.params,
          data.from,
        );
      },
      PROTOCOL_MESSAGE_EVENT: (data: NodeMessageWrappedProtocolMessage): void => {
        this.logEvent(PROTOCOL_MESSAGE_EVENT, data);
      },
      REJECT_INSTALL_EVENT: async (data: RejectProposalMessage): Promise<void> => {
        this.logEvent(REJECT_INSTALL_EVENT, data);

        const transfer = await this.linkedTransferRepository.findByReceiverAppInstanceId(
          data.data.appInstanceId,
        );
        if (!transfer) {
          this.log.debug(`Transfer not found`);
          return;
        }
        transfer.status = LinkedTransferStatus.FAILED;
        await this.linkedTransferRepository.save(transfer);
      },
      UNINSTALL_EVENT: async (data: UninstallMessage): Promise<void> => {
        this.logEvent(UNINSTALL_EVENT, data);
        // check if app being uninstalled is a receiver app for a transfer
        // if so, try to uninstall the sender app
        try {
          await this.linkedTransferService.reclaimLinkedTransferCollateralByAppInstanceIdIfExists(
            data.data.appInstanceId,
          );
        } catch (e) {
          if (e.message.includes(`Could not find transfer`)) {
            return;
          }
          throw e;
        }
      },
      UPDATE_STATE_EVENT: async (data: UpdateStateMessage): Promise<void> => {
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.log.debug(`Received update state from our own node. Doing nothing.`);
          return;
        }
        // if this is for a recipient of a transfer
        this.logEvent(UPDATE_STATE_EVENT, data);
        const { newState, appInstanceId, action } = data.data;
        const app = await this.cfCoreService.getAppInstanceDetails(appInstanceId);
        const appRegistryInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
          app.appInterface.addr,
        );
        if (!appRegistryInfo) {
          throw new Error(
            `Could not find registry info for updated app ${data.data.appInstanceId}`,
          );
        }
        await this.appActionsService.handleAppAction(
          appRegistryInfo.name,
          appInstanceId,
          newState as any,
          action as any,
          data.from,
        );
      },
      WITHDRAWAL_CONFIRMED_EVENT: (data: WithdrawConfirmationMessage): void => {
        this.logEvent(WITHDRAWAL_CONFIRMED_EVENT, data);
      },
      WITHDRAWAL_FAILED_EVENT: (data: WithdrawFailedMessage): void => {
        this.logEvent(WITHDRAWAL_FAILED_EVENT, data);
      },
      WITHDRAWAL_STARTED_EVENT: (data: WithdrawStartedMessage): void => {
        this.logEvent(WITHDRAWAL_STARTED_EVENT, data);
      },
    };
  }

  onModuleInit(): void {
    Object.entries(this.getEventListeners()).forEach(
      ([event, callback]: [CFCoreTypes.EventName, () => any]): void => {
        this.cfCoreService.registerCfCoreListener(event, callback);
      },
    );

    this.cfCoreService.registerCfCoreListener(ProtocolTypes.chan_uninstall as any, (data: any) => {
      this.log.debug(
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
    });
  }
}
