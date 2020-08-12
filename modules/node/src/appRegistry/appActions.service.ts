import {
  AppAction,
  AppState,
  AppInstanceJson,
  ConditionalTransferAppNames,
  SupportedApplicationNames,
} from "@connext/types";
import { Injectable } from "@nestjs/common";

import { LoggerService } from "../logger/logger.service";
import { CFCoreService } from "../cfCore/cfCore.service";
import { AppInstance, AppType } from "../appInstance/appInstance.entity";
import { TransferService } from "../transfer/transfer.service";

@Injectable()
export class AppActionsService {
  constructor(
    private readonly log: LoggerService,
    private readonly cfCoreService: CFCoreService,
    private readonly transferService: TransferService,
  ) {
    this.log.setContext("AppActionsService");
  }

  async handleAppAction(
    appName: SupportedApplicationNames,
    app: AppInstanceJson,
    newState: AppState,
    action: AppAction,
    from: string,
  ): Promise<void> {
    this.log.info(
      `handleAppAction for app name ${appName} ${app.identityHash}, action ${JSON.stringify(
        action,
      )} started`,
    );

    if (Object.keys(ConditionalTransferAppNames).includes(appName)) {
      const senderApp = await this.transferService.findSenderAppByPaymentId(app.meta.paymentId);
      if (!senderApp) {
        throw new Error(
          `Action taken on tranfer app without corresponding sender app! ${app.identityHash}`,
        );
      }
      await this.handleTransferAppAction(senderApp, action);
    }
    this.log.info(`handleAppAction for app name ${appName} ${app.identityHash} complete`);
  }

  private async handleTransferAppAction(senderApp: AppInstance, action: AppAction): Promise<void> {
    // App could be uninstalled, which means the channel is no longer
    // associated with this app instance
    if (senderApp.type !== AppType.INSTANCE) {
      return;
    }
    await this.cfCoreService.uninstallApp(senderApp.identityHash, senderApp.channel, action);
  }
}
