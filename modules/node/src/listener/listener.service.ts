import {
  AppAction,
  EventName,
  EventNames,
  GenericConditionalTransferAppState,
  ProtocolEventMessage,
  SupportedApplicationNames,
  SyncMessage,
  UninstallFailedMessage,
  UninstallMessage,
  WatcherEventData,
  WatcherEvents,
} from "@connext/types";
import { Injectable, OnModuleInit } from "@nestjs/common";

import { AppRegistryService } from "../appRegistry/appRegistry.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService, RebalanceType } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { AppActionsService } from "../appRegistry/appActions.service";
import { AppInstanceRepository } from "../appInstance/appInstance.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { TransferRepository } from "../transfer/transfer.repository";
import { ConfigService } from "../config/config.service";

const {
  CONDITIONAL_TRANSFER_CREATED_EVENT,
  CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
  CONDITIONAL_TRANSFER_FAILED_EVENT,
  WITHDRAWAL_CONFIRMED_EVENT,
  WITHDRAWAL_FAILED_EVENT,
  WITHDRAWAL_STARTED_EVENT,
  CREATE_CHANNEL_EVENT,
  SETUP_FAILED_EVENT,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DEPOSIT_STARTED_EVENT,
  INSTALL_EVENT,
  INSTALL_FAILED_EVENT,
  PROPOSE_INSTALL_EVENT,
  PROPOSE_INSTALL_FAILED_EVENT,
  PROTOCOL_MESSAGE_EVENT,
  REJECT_INSTALL_EVENT,
  SYNC,
  SYNC_FAILED_EVENT,
  UNINSTALL_EVENT,
  UNINSTALL_FAILED_EVENT,
  UPDATE_STATE_EVENT,
  UPDATE_STATE_FAILED_EVENT,
} = EventNames;

type ProtocolCallback = {
  [index in keyof typeof EventNames]: (data: ProtocolEventMessage<index>) => Promise<any> | void;
};

type WatcherCallback = {
  [index in keyof typeof WatcherEvents]: (data: WatcherEventData[index]) => Promise<any> | void;
};

type CallbackStruct = WatcherCallback | ProtocolCallback;

@Injectable()
export default class ListenerService implements OnModuleInit {
  constructor(
    private readonly appRegistryService: AppRegistryService,
    private readonly appActionsService: AppActionsService,
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly log: LoggerService,
    private readonly appInstanceRepository: AppInstanceRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly transferRepository: TransferRepository,
  ) {
    this.log.setContext("ListenerService");
  }

  // TODO: better typing
  logEvent<T extends EventName>(event: T, res: any): void {
    if (Object.keys(WatcherEvents).includes(event)) {
      this.log.debug(`${event} event caught, data: ${JSON.stringify(res)}`);
    } else {
      this.log.debug(
        `${event} event fired from ${res && res.from ? res.from : null}, data: ${
          res ? JSON.stringify(res.data) : `event did not have a result`
        }`,
      );
    }
  }

  getEventListeners(): CallbackStruct {
    return {
      CONDITIONAL_TRANSFER_CREATED_EVENT: (data): void => {
        this.logEvent(CONDITIONAL_TRANSFER_CREATED_EVENT, data);
      },
      CONDITIONAL_TRANSFER_UNLOCKED_EVENT: (data): void => {
        this.logEvent(CONDITIONAL_TRANSFER_UNLOCKED_EVENT, data);
      },
      CONDITIONAL_TRANSFER_FAILED_EVENT: (data): void => {
        this.logEvent(CONDITIONAL_TRANSFER_FAILED_EVENT, data);
      },
      CREATE_CHANNEL_EVENT: async (data): Promise<void> => {
        this.logEvent(CREATE_CHANNEL_EVENT, data);
        await this.channelService.makeAvailable(data);
      },
      SETUP_FAILED_EVENT: (data): void => {
        this.logEvent(SETUP_FAILED_EVENT, data);
      },
      DEPOSIT_CONFIRMED_EVENT: (data): void => {
        this.logEvent(DEPOSIT_CONFIRMED_EVENT, data);
      },
      DEPOSIT_FAILED_EVENT: (data): void => {
        this.logEvent(DEPOSIT_FAILED_EVENT, data);
      },
      DEPOSIT_STARTED_EVENT: (data): void => {
        this.logEvent(DEPOSIT_STARTED_EVENT, data);
      },
      INSTALL_EVENT: async (data): Promise<void> => {
        this.logEvent(INSTALL_EVENT, data);
      },
      INSTALL_FAILED_EVENT: (data): void => {
        this.logEvent(INSTALL_FAILED_EVENT, data);
      },
      PROPOSE_INSTALL_EVENT: async (data): Promise<void> => {
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.log.debug(`Received proposal from our own node. Doing nothing.`);
          return;
        }
        this.logEvent(PROPOSE_INSTALL_EVENT, data);
        await this.appRegistryService.installOrReject(
          data.data.appInstanceId,
          data.data.params as any,
          data.from,
        );
      },
      PROPOSE_INSTALL_FAILED_EVENT: (data): void => {
        this.logEvent(PROPOSE_INSTALL_FAILED_EVENT, data);
      },
      PROTOCOL_MESSAGE_EVENT: (data): void => {
        this.logEvent(PROTOCOL_MESSAGE_EVENT, data);
      },
      REJECT_INSTALL_EVENT: (data): void => {
        this.logEvent(REJECT_INSTALL_EVENT, data);
      },
      SYNC: (data: SyncMessage): void => {
        this.logEvent(SYNC, data);
      },
      SYNC_FAILED_EVENT: (data): void => {
        this.logEvent(SYNC_FAILED_EVENT, data);
      },
      UNINSTALL_EVENT: async (data): Promise<void> => {
        this.logEvent(UNINSTALL_EVENT, data);
        await this.handleUninstall(data);
      },
      UNINSTALL_FAILED_EVENT: async (data): Promise<void> => {
        this.logEvent(UNINSTALL_FAILED_EVENT, data);
        await this.handleUninstallFailed(data);
      },
      UPDATE_STATE_EVENT: async (data): Promise<void> => {
        if (data.from === this.cfCoreService.cfCore.publicIdentifier) {
          this.log.debug(`Received update state where we were initiator. Doing nothing.`);
          return;
        }
        // if this is for a recipient of a transfer
        this.logEvent(UPDATE_STATE_EVENT, data);
        const { newState, appIdentityHash, action } = data.data;
        const app = await this.cfCoreService.getAppInstance(appIdentityHash);
        const appRegistryInfo = this.cfCoreService.getAppInfoByAppDefinitionAddress(
          app.appDefinition,
        );
        if (!appRegistryInfo) {
          throw new Error(
            `Could not find registry info for updated app ${data.data.appIdentityHash}`,
          );
        }
        await this.appActionsService.handleAppAction(
          appRegistryInfo.name as SupportedApplicationNames,
          app,
          newState as any, // AppState (excluding simple swap app)
          action as AppAction,
          data.from,
        );
      },
      UPDATE_STATE_FAILED_EVENT: (data): void => {
        this.logEvent(UPDATE_STATE_FAILED_EVENT, data);
      },
      WITHDRAWAL_FAILED_EVENT: (data): void => {
        this.logEvent(WITHDRAWAL_FAILED_EVENT, data);
      },
      WITHDRAWAL_CONFIRMED_EVENT: (data): void => {
        this.logEvent(WITHDRAWAL_CONFIRMED_EVENT, data);
      },
      WITHDRAWAL_STARTED_EVENT: (data): void => {
        this.logEvent(WITHDRAWAL_STARTED_EVENT, data);
      },

      // watcher events
      CHALLENGE_UPDATED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_UPDATED_EVENT, msg);
      },
      STATE_PROGRESSED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.STATE_PROGRESSED_EVENT, msg);
      },
      CHALLENGE_PROGRESSED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_PROGRESSED_EVENT, msg);
      },
      CHALLENGE_PROGRESSION_FAILED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_PROGRESSION_FAILED_EVENT, msg);
      },
      CHALLENGE_OUTCOME_FAILED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_OUTCOME_FAILED_EVENT, msg);
      },
      CHALLENGE_OUTCOME_SET_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_OUTCOME_SET_EVENT, msg);
      },
      CHALLENGE_COMPLETED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_COMPLETED_EVENT, msg);
      },
      CHALLENGE_COMPLETION_FAILED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_COMPLETION_FAILED_EVENT, msg);
      },
      CHALLENGE_CANCELLED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_CANCELLED_EVENT, msg);
      },
      CHALLENGE_CANCELLATION_FAILED_EVENT: (msg) => {
        this.logEvent(WatcherEvents.CHALLENGE_CANCELLATION_FAILED_EVENT, msg);
      },
    };
  }

  async handleUninstallFailed(data: UninstallFailedMessage) {
    const { params } = data.data;
    const receiverApp = await this.appInstanceRepository.findByIdentityHash(params.appIdentityHash);
    const nodeSignerAddress = await this.configService.getSignerAddress();
    if (
      receiverApp?.meta?.paymentId &&
      (receiverApp?.latestState as GenericConditionalTransferAppState).coinTransfers[1].to !==
        nodeSignerAddress
    ) {
      this.log.warn(
        `Uninstall failed, removing stored action for paymentId ${receiverApp.meta.paymentId}`,
      );
      await this.transferRepository.removeTransferAction(receiverApp.meta.paymentId);
    }
  }

  async handleUninstall(data: UninstallMessage) {
    const { action, uninstalledApp, multisigAddress, appIdentityHash } = data.data;
    if (!multisigAddress) {
      this.log.error(
        `Unexpected error - no multisigAddress found in uninstall event data: ${appIdentityHash}`,
      );
      return;
    }
    const channel = await this.channelRepository.findByMultisigAddressOrThrow(multisigAddress);
    if (action) {
      const appRegistryInfo = this.cfCoreService.getAppInfoByAppDefinitionAddress(
        uninstalledApp.appDefinition,
      );
      await this.appActionsService.handleAppAction(
        appRegistryInfo.name as SupportedApplicationNames,
        uninstalledApp,
        uninstalledApp.latestState as any, // AppState (excluding simple swap app)
        action as AppAction,
        data.from,
      );
    }

    const assetIdResponder = (
      await this.appInstanceRepository.findByIdentityHashOrThrow(data.data.appIdentityHash)
    ).responderDepositAssetId;
    try {
      await this.channelService.rebalance(
        channel.multisigAddress,
        assetIdResponder,
        RebalanceType.RECLAIM,
      );
    } catch (e) {
      this.log.error(`Caught error rebalancing channel ${channel.multisigAddress}: ${e.stack}`);
    }
  }

  onModuleInit(): void {
    Object.entries(
      this.getEventListeners(),
    ).forEach(
      ([event, callback]: [any, (data: ProtocolEventMessage<any>) => void | Promise<void>]) =>
        this.cfCoreService.registerCfCoreListener(event, callback),
    );
  }
}
