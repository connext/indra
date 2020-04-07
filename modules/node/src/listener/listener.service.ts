import { AppAction, EventNames, MethodNames, NodeMessage } from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { MessagingService } from "@connext/messaging";
import { AddressZero } from "ethers/constants";

import { AppRegistryService } from "../appRegistry/appRegistry.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId } from "../constants";
import { LinkedTransferService } from "../linkedTransfer/linkedTransfer.service";
import {
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
} from "../util/cfCore";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { AppActionsService } from "../appRegistry/appActions.service";
import { AppType } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";

const {
  CONDITIONAL_TRANSFER_CREATED_EVENT,
  CONDITIONAL_TRANSFER_RECEIVED_EVENT,
  CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
  CONDITIONAL_TRANSFER_FAILED_EVENT,
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
} = EventNames;

type CallbackStruct = {
  [index in EventNames]: (data: any) => Promise<any> | void;
};

@Injectable()
export default class ListenerService implements OnModuleInit {
  constructor(
    private readonly appRegistryService: AppRegistryService,
    private readonly appActionsService: AppActionsService,
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    @Inject(MessagingProviderId) private readonly messagingService: MessagingService,
    private readonly log: LoggerService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("ListenerService");
  }

  logEvent(event: EventNames, res: NodeMessage & { data: any }): void {
    this.log.debug(
      `${event} event fired from ${res && res.from ? res.from : null}, data: ${
        res ? JSON.stringify(res.data) : `event did not have a result`
      }`,
    );
  }

  getEventListeners(): CallbackStruct {
    return {
      CONDITIONAL_TRANSFER_CREATED_EVENT: (data: DepositConfirmationMessage): void => {
        this.logEvent(CONDITIONAL_TRANSFER_CREATED_EVENT, data);
      },
      CONDITIONAL_TRANSFER_RECEIVED_EVENT: (data: DepositConfirmationMessage): void => {
        this.logEvent(CONDITIONAL_TRANSFER_RECEIVED_EVENT, data);
      },
      CONDITIONAL_TRANSFER_UNLOCKED_EVENT: (data: DepositConfirmationMessage): void => {
        this.logEvent(CONDITIONAL_TRANSFER_UNLOCKED_EVENT, data);
      },
      CONDITIONAL_TRANSFER_FAILED_EVENT: (data: DepositConfirmationMessage): void => {
        this.logEvent(CONDITIONAL_TRANSFER_FAILED_EVENT, data);
      },
      CREATE_CHANNEL_EVENT: async (data: CreateChannelMessage): Promise<void> => {
        this.logEvent(CREATE_CHANNEL_EVENT, data);
        this.channelService.makeAvailable(data);
      },
      DEPOSIT_CONFIRMED_EVENT: (data: DepositConfirmationMessage): void => {
        this.logEvent(DEPOSIT_CONFIRMED_EVENT, data);
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
          data.data.appIdentityHash,
          data.data.params,
          data.from,
        );
      },
      PROTOCOL_MESSAGE_EVENT: (data: NodeMessageWrappedProtocolMessage): void => {
        this.logEvent(PROTOCOL_MESSAGE_EVENT, data);
      },
      REJECT_INSTALL_EVENT: async (data: RejectProposalMessage): Promise<void> => {
        this.logEvent(REJECT_INSTALL_EVENT, data);

        // update app status
        const rejectedApp = await this.appInstanceRepository.findByIdentityHash(
          data.data.appIdentityHash,
        );
        if (!rejectedApp) {
          this.log.debug(`No app found`);
          return;
        }
        rejectedApp.type = AppType.REJECTED;
        await this.appInstanceRepository.save(rejectedApp);
      },
      UNINSTALL_EVENT: async (data: UninstallMessage): Promise<void> => {
        this.logEvent(UNINSTALL_EVENT, data);
      },
      UPDATE_STATE_EVENT: async (data: UpdateStateMessage): Promise<void> => {
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.log.debug(`Received update state from our own node. Doing nothing.`);
          return;
        }
        // if this is for a recipient of a transfer
        this.logEvent(UPDATE_STATE_EVENT, data);
        const { newState, appIdentityHash, action } = data.data;
        const app = await this.cfCoreService.getAppInstance(appIdentityHash);
        const appRegistryInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
          app.appInterface.addr,
        );
        if (!appRegistryInfo) {
          throw new Error(
            `Could not find registry info for updated app ${data.data.appIdentityHash}`,
          );
        }
        await this.appActionsService.handleAppAction(
          appRegistryInfo.name,
          app,
          newState as any, // AppState (excluding simple swap app)
          action as AppAction,
          data.from,
        );
      },
      WITHDRAWAL_FAILED_EVENT: (data: DepositFailedMessage): void => {
        this.logEvent(WITHDRAWAL_FAILED_EVENT, data);
      },
      WITHDRAWAL_CONFIRMED_EVENT: (data: DepositFailedMessage): void => {
        this.logEvent(WITHDRAWAL_CONFIRMED_EVENT, data);
      },
      WITHDRAWAL_STARTED_EVENT: (data: DepositFailedMessage): void => {
        this.logEvent(WITHDRAWAL_STARTED_EVENT, data);
      },
    };
  }

  onModuleInit(): void {
    Object.entries(this.getEventListeners()).forEach(
      ([event, callback]: [EventNames, () => any]): void => {
        this.cfCoreService.registerCfCoreListener(event, callback);
      },
    );

    this.cfCoreService.registerCfCoreListener(
      MethodNames.chan_uninstall as any,
      async (data: any) => {
        // TODO: GET CHANNEL MULTISIG
        const uninstallSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${AddressZero}.app-instance.${data.result.result.appIdentityHash}.uninstall`;
        await this.messagingService.publish(uninstallSubject, data.result.result);
      },
    );
  }
}
