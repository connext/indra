import { Node as CFCoreTypes } from "@counterfactual/types";
import { Injectable, OnModuleInit } from "@nestjs/common";

import { AppRegistryService } from "../appRegistry/appRegistry.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelService } from "../channel/channel.service";
import { LinkedTransferStatus } from "../transfer/transfer.entity";
import { LinkedTransferRepository } from "../transfer/transfer.repository";
import { TransferService } from "../transfer/transfer.service";
import { CLogger } from "../util";
import {
  CreateChannelMessage,
  DepositConfirmationMessage,
  InstallMessage,
  InstallVirtualMessage,
  ProposeMessage,
  ProposeVirtualMessage,
  RejectInstallVirtualMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawMessage,
} from "../util/cfCore";

const logger = new CLogger("ListenerService");

type CallbackStruct = {
  [index in keyof typeof CFCoreTypes.EventName]: (data: any) => Promise<any> | void;
};

function logEvent(
  event: CFCoreTypes.EventName,
  res: CFCoreTypes.NodeMessage & { data: any },
): void {
  logger.log(
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
    private readonly linkedTransferRepository: LinkedTransferRepository,
  ) {}

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
      DEPOSIT_FAILED: (data: any): void => {
        logEvent(CFCoreTypes.EventName.DEPOSIT_FAILED, data);
      },
      DEPOSIT_STARTED: (data: any): void => {
        logEvent(CFCoreTypes.EventName.DEPOSIT_STARTED, data);
      },
      INSTALL: async (data: InstallMessage): Promise<void> => {
        logEvent(CFCoreTypes.EventName.INSTALL, data);
      },
      // TODO: make cf return app instance id and app def?
      INSTALL_VIRTUAL: async (data: InstallVirtualMessage): Promise<void> => {
        logEvent(CFCoreTypes.EventName.INSTALL_VIRTUAL, data);
      },
      PROPOSE_INSTALL: (data: ProposeMessage): void => {
        logEvent(CFCoreTypes.EventName.PROPOSE_INSTALL, data);
        this.appRegistryService.allowOrReject(data);
      },
      PROPOSE_INSTALL_VIRTUAL: (data: ProposeVirtualMessage): void => {
        logEvent(CFCoreTypes.EventName.PROPOSE_INSTALL_VIRTUAL, data);
        this.appRegistryService.allowOrRejectVirtual(data);
      },
      PROPOSE_STATE: (data: any): void => {
        // TODO: need to validate all apps here as well?
        logEvent(CFCoreTypes.EventName.PROPOSE_STATE, data);
      },
      PROTOCOL_MESSAGE_EVENT: (data: any): void => {
        logEvent(CFCoreTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
      },
      REJECT_INSTALL: async (data: any): Promise<void> => {
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
      REJECT_STATE: (data: any): void => {
        logEvent(CFCoreTypes.EventName.REJECT_STATE, data);
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
      WITHDRAW_EVENT: (data: any): void => {
        logEvent(CFCoreTypes.EventName.WITHDRAW_EVENT, data);
      },
      WITHDRAWAL_CONFIRMED: (data: WithdrawMessage): void => {
        logEvent(CFCoreTypes.EventName.WITHDRAWAL_CONFIRMED, data);
      },
      WITHDRAWAL_FAILED: (data: any): void => {
        logEvent(CFCoreTypes.EventName.WITHDRAWAL_FAILED, data);
      },
      WITHDRAWAL_STARTED: (data: any): void => {
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
  }
}
