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
} from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Injectable, OnModuleInit } from "@nestjs/common";

import { AppRegistryService } from "../appRegistry/appRegistry.service";
import { ChannelService } from "../channel/channel.service";
import { NodeService } from "../node/node.service";
import { CLogger } from "../util";

const logger = new CLogger("ListenerService");

type CallbackStruct = {
  [index in keyof typeof NodeTypes.EventName]: (data: any) => Promise<any> | void;
};

function logEvent(event: NodeTypes.EventName, res: NodeTypes.NodeMessage & { data: any }): void {
  logger.log(
    `${event} event fired from ${res && res.from ? res.from : null}, data: ${
      res ? JSON.stringify(res.data) : "event did not have a result"
    }`,
  );
}

@Injectable()
export default class ListenerService implements OnModuleInit {
  constructor(
    private readonly nodeService: NodeService,
    private readonly appRegistryService: AppRegistryService,
    private readonly channelService: ChannelService,
  ) {}

  getEventListeners(): CallbackStruct {
    return {
      COUNTER_DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
        logEvent(NodeTypes.EventName.COUNTER_DEPOSIT_CONFIRMED, data);
      },
      CREATE_CHANNEL: async (data: CreateChannelMessage): Promise<void> => {
        logEvent(NodeTypes.EventName.CREATE_CHANNEL, data);
        this.channelService.makeAvailable(data);
      },
      DEPOSIT_CONFIRMED: (data: DepositConfirmationMessage): void => {
        logEvent(NodeTypes.EventName.DEPOSIT_CONFIRMED, data);
      },
      DEPOSIT_FAILED: (data: any): void => {
        logEvent(NodeTypes.EventName.DEPOSIT_FAILED, data);
      },
      DEPOSIT_STARTED: (data: any): void => {
        logEvent(NodeTypes.EventName.DEPOSIT_STARTED, data);
      },
      INSTALL: async (data: InstallMessage): Promise<void> => {
        logEvent(NodeTypes.EventName.INSTALL, data);
        const info = await this.nodeService.getAppInstanceDetails(data.data.params.appInstanceId);
      },
      // TODO: make cf return app instance id and app def?
      INSTALL_VIRTUAL: async (data: InstallVirtualMessage): Promise<void> => {
        logEvent(NodeTypes.EventName.INSTALL_VIRTUAL, data);
        const info = await this.nodeService.getAppInstanceDetails(data.data.params.appInstanceId);
      },
      PROPOSE_INSTALL: (data: ProposeMessage): void => {
        logEvent(NodeTypes.EventName.PROPOSE_INSTALL, data);
        this.appRegistryService.allowOrReject(data);
      },
      PROPOSE_INSTALL_VIRTUAL: (data: ProposeVirtualMessage): void => {
        logEvent(NodeTypes.EventName.PROPOSE_INSTALL_VIRTUAL, data);
        this.appRegistryService.allowOrRejectVirtual(data);
      },
      PROPOSE_STATE: (data: any): void => {
        // TODO: need to validate all apps here as well?
        logEvent(NodeTypes.EventName.PROPOSE_STATE, data);
      },
      PROTOCOL_MESSAGE_EVENT: (data: any): void => {
        logEvent(NodeTypes.EventName.PROTOCOL_MESSAGE_EVENT, data);
      },
      REJECT_INSTALL: (data: any): void => {
        logEvent(NodeTypes.EventName.REJECT_INSTALL, data);
      },
      REJECT_INSTALL_VIRTUAL: (data: RejectInstallVirtualMessage): void => {
        logEvent(NodeTypes.EventName.REJECT_INSTALL_VIRTUAL, data);
      },
      REJECT_STATE: (data: any): void => {
        logEvent(NodeTypes.EventName.REJECT_STATE, data);
      },
      UNINSTALL: (data: UninstallMessage): void => {
        logEvent(NodeTypes.EventName.UNINSTALL, data);
      },
      UNINSTALL_VIRTUAL: async (data: UninstallVirtualMessage): Promise<void> => {
        logEvent(NodeTypes.EventName.UNINSTALL_VIRTUAL, data);
        const info = await this.nodeService.getAppInstanceDetails(data.data.appInstanceId);
      },
      UPDATE_STATE: (data: UpdateStateMessage): void => {
        logEvent(NodeTypes.EventName.UPDATE_STATE, data);
      },
      WITHDRAW_EVENT: (data: any): void => {
        logEvent(NodeTypes.EventName.WITHDRAW_EVENT, data);
      },
      WITHDRAWAL_CONFIRMED: (data: WithdrawMessage): void => {
        logEvent(NodeTypes.EventName.WITHDRAWAL_CONFIRMED, data);
      },
      WITHDRAWAL_FAILED: (data: any): void => {
        logEvent(NodeTypes.EventName.WITHDRAWAL_FAILED, data);
      },
      WITHDRAWAL_STARTED: (data: any): void => {
        logEvent(NodeTypes.EventName.WITHDRAWAL_STARTED, data);
      },
    };
  }

  onModuleInit(): void {
    Object.entries(this.getEventListeners()).forEach(
      ([event, callback]: [NodeTypes.EventName, () => any]): void => {
        this.nodeService.registerCfNodeListener(NodeTypes.EventName[event], callback, logger.cxt);
      },
    );
  }
}
