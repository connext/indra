import {
  AppAction,
  CreateChannelMessage,
  DepositConfirmationMessage,
  DepositFailedMessage,
  DepositStartedMessage,
  EventNames,
  InstallMessage,
  Message,
  MethodNames,
  ProposeMessage,
  ProtocolMessage,
  RejectProposalMessage,
  UninstallMessage,
  UpdateStateMessage,
  SyncMessage,
} from "@connext/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { MessagingService } from "@connext/messaging";
import { constants } from "ethers";

import { AppRegistryService } from "../appRegistry/appRegistry.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingProviderId } from "../constants";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { AppActionsService } from "../appRegistry/appActions.service";
import { AppType } from "../appInstance/appInstance.entity";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ChannelRepository } from "../channel/channel.repository";

const {
  CONDITIONAL_TRANSFER_CREATED_EVENT,
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
  SYNC,
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
    private readonly channelRepository: ChannelRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly appInstanceRepository: AppInstanceRepository,
  ) {
    this.log.setContext("ListenerService");
  }

  logEvent(event: EventNames, res: Message & { data: any }): void {
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
      PROTOCOL_MESSAGE_EVENT: (data: ProtocolMessage): void => {
        this.logEvent(PROTOCOL_MESSAGE_EVENT, data);
      },
      REJECT_INSTALL_EVENT: async (data: RejectProposalMessage): Promise<void> => {
        this.logEvent(REJECT_INSTALL_EVENT, data);
        return;
      },
      SYNC: (data: SyncMessage): void => {
        this.logEvent(SYNC, data);
      },
      UNINSTALL_EVENT: async (data: UninstallMessage): Promise<void> => {
        if (!data.data.multisigAddress) {
          this.log.error(
            `Unexpected error - no multisigAddress found in uninstall event data: ${data.data.appIdentityHash}`,
          );
          return;
        }
        const channel = await this.channelRepository.findByMultisigAddressOrThrow(
          data.data.multisigAddress,
        );
        const assetIdResponder = (
          await this.appInstanceRepository.findByIdentityHashOrThrow(data.data.appIdentityHash)
        ).responderDepositAssetId;
        // attempt a rebalance without blocking
        this.channelService.rebalance(channel, assetIdResponder).catch((e) => {
          this.log.error(
            `Caught error rebalancing channel ${channel.multisigAddress}: ${e.stack || e.message}`,
          );
        });
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
        const uninstallSubject = `${this.cfCoreService.cfCore.publicIdentifier}.channel.${constants.AddressZero}.app-instance.${data.result.result.appIdentityHash}.uninstall`;
        await this.messagingService.publish(uninstallSubject, data.result.result);
      },
    );
  }
}
