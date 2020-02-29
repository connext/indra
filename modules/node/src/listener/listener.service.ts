import {
  SimpleLinkedTransferAppState,
  CREATE_CHANNEL_EVENT,
  DEPOSIT_CONFIRMED_EVENT,
  DEPOSIT_FAILED_EVENT,
  DEPOSIT_STARTED_EVENT,
  INSTALL_EVENT,
  INSTALL_VIRTUAL_EVENT,
  PROPOSE_INSTALL_EVENT,
  PROTOCOL_MESSAGE_EVENT,
  REJECT_INSTALL_EVENT,
  UNINSTALL_EVENT,
  UNINSTALL_VIRTUAL_EVENT,
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
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { LoggerService } from "../logger/logger.service";
import { MessagingClientProviderId } from "../constants";
import { LinkedTransferStatus } from "../transfer/transfer.entity";
import { LinkedTransferRepository } from "../transfer/transfer.repository";
import { TransferService } from "../transfer/transfer.service";
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
  RejectProposalMessage,
  UninstallMessage,
  UninstallVirtualMessage,
  UpdateStateMessage,
  WithdrawConfirmationMessage,
  WithdrawFailedMessage,
  WithdrawStartedMessage,
} from "../util/cfCore";

type CallbackStruct = {
  [index in CFCoreTypes.EventName]: (data: any) => Promise<any> | void;
};

@Injectable()
export default class ListenerService implements OnModuleInit {
  constructor(
    private readonly appRegistryService: AppRegistryService,
    private readonly cfCoreService: CFCoreService,
    private readonly channelRepository: ChannelRepository,
    private readonly channelService: ChannelService,
    private readonly linkedTransferRepository: LinkedTransferRepository,
    private readonly log: LoggerService,
    private readonly transferService: TransferService,
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
      // TODO: make cf return app instance id and app def?
      INSTALL_VIRTUAL_EVENT: async (data: InstallVirtualMessage): Promise<void> => {
        this.logEvent(INSTALL_VIRTUAL_EVENT, data);
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
        // TODO: i think there are race conditions here that are causing errors
        // let's reenable this when we figure it out better. for now, the node will
        // reclaim on client check-in
        // await this.transferService.reclaimLinkedTransferCollateralByAppInstanceIdIfExists(
        //   data.data.appInstanceId,
        // );
      },
      UNINSTALL_VIRTUAL_EVENT: (data: UninstallVirtualMessage): void => {
        this.logEvent(UNINSTALL_VIRTUAL_EVENT, data);
      },
      UPDATE_STATE_EVENT: async (data: UpdateStateMessage): Promise<void> => {
        // if this is for a recipient of a transfer
        this.logEvent(UPDATE_STATE_EVENT, data);
        const { newState, appInstanceId } = data.data;
        let transfer = await this.linkedTransferRepository.findByLinkedHash(
          (newState as SimpleLinkedTransferAppState).linkedHash,
        );
        if (!transfer) {
          this.log.debug(
            `Could not find transfer for update state event for app: ${appInstanceId}`,
          );
          return;
        }
        if (appInstanceId !== transfer.receiverAppInstanceId) {
          this.log.debug(
            `Not updating transfer preimage or marking as redeemed for sender update state events`,
          );
          return;
        }
        // update transfer
        transfer.preImage = (newState as SimpleLinkedTransferAppState).preImage;

        if (
          transfer.status === LinkedTransferStatus.RECLAIMED ||
          transfer.status === LinkedTransferStatus.REDEEMED
        ) {
          this.log.warn(
            `Got update state event for a receiver's transfer app (transfer.id: ${transfer.id}) with unexpected status: ${transfer.status}`,
          );
          return;
        }

        // transfers are set to `PENDING` when created. They are set to
        // `FAILED` when the receiver rejects an install event. If a transfer
        // makes it to the `UPDATE_STATE_EVENT` portion, it means the transfer
        // was successfully installed. There is no reason to not redeem it in
        // that case.
        transfer = await this.linkedTransferRepository.markAsRedeemed(
          transfer,
          await this.channelRepository.findByUserPublicIdentifier(data.from),
        );
        this.log.debug(`Marked transfer as redeemed with preImage: ${transfer.preImage}`);
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

    this.cfCoreService.registerCfCoreListener(ProtocolTypes.chan_install as any, (data: any) => {
      const appInstance = data.result.result.appInstance;
      this.log.debug(
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
    });

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
