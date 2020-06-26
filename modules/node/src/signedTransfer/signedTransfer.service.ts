import {
  SignedTransferStatus,
  SimpleSignedTransferAppName,
  GraphSignedTransferAppName,
} from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { CFCoreService } from "../cfCore/cfCore.service";
import { LoggerService } from "../logger/logger.service";
import { AppType, AppInstance } from "../appInstance/appInstance.entity";
import { SignedTransferRepository } from "./signedTransfer.repository";

type SignedTransferTypes = typeof SimpleSignedTransferAppName | typeof GraphSignedTransferAppName;

const appStatusesToSignedTransferStatus = (
  senderApp: AppInstance<SignedTransferTypes>,
  receiverApp?: AppInstance<SignedTransferTypes>,
): SignedTransferStatus | undefined => {
  if (!senderApp) {
    return undefined;
  }
  // pending iff no receiver app + not expired
  if (!receiverApp) {
    return SignedTransferStatus.PENDING;
  } else if (senderApp.type === AppType.UNINSTALLED || receiverApp.type === AppType.UNINSTALLED) {
    return SignedTransferStatus.COMPLETED;
  } else if (senderApp.type === AppType.REJECTED || receiverApp.type === AppType.REJECTED) {
    return SignedTransferStatus.FAILED;
  } else {
    throw new Error(
      `Could not determine signed transfer status. Sender app type: ${
        senderApp && senderApp.type
      }, receiver app type: ${receiverApp && receiverApp.type}`,
    );
  }
};

export function normalizeSignedTransferAppState<T extends SignedTransferTypes>(
  app: AppInstance,
): AppInstance<T> | undefined {
  return (
    app && {
      ...app,
      latestState: bigNumberifyJson(app.latestState),
    }
  );
}

@Injectable()
export class SignedTransferService {
  constructor(
    private readonly log: LoggerService,
    private readonly cfCoreService: CFCoreService,
    private readonly signedTransferRepository: SignedTransferRepository,
  ) {
    this.log.setContext("SignedTransferService");
  }

  async findSenderAndReceiverAppsWithStatus<T extends SignedTransferTypes>(
    paymentId: string,
    appName: T,
  ): Promise<
    | {
        senderApp: AppInstance<T>;
        receiverApp: AppInstance<T>;
        status: any;
      }
    | undefined
  > {
    this.log.info(`findSenderAndReceiverAppsWithStatus ${paymentId} started`);
    const senderApp = await this.findSenderAppByPaymentId(paymentId, appName);
    const receiverApp = await this.findReceiverAppByPaymentId(paymentId, appName);
    const status = appStatusesToSignedTransferStatus(senderApp, receiverApp);
    const result = { senderApp, receiverApp, status };
    this.log.info(
      `findSenderAndReceiverAppsWithStatus ${paymentId} complete: ${JSON.stringify(result)}`,
    );
    return result;
  }

  async findSenderAppByPaymentId<T extends SignedTransferTypes>(
    paymentId: string,
    appName: T,
  ): Promise<AppInstance<T>> {
    this.log.info(`findSenderAppByPaymentId ${paymentId} started`);
    // node receives from sender
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
      this.cfCoreService.getAppInfoByName(appName).appDefinitionAddress,
    );
    const result = normalizeSignedTransferAppState<T>(app);
    this.log.info(`findSenderAppByPaymentId ${paymentId} completed: ${JSON.stringify(result)}`);
    return result;
  }

  async findReceiverAppByPaymentId<T extends SignedTransferTypes>(
    paymentId: string,
    appName: T,
  ): Promise<AppInstance<T>> {
    this.log.info(`findReceiverAppByPaymentId ${paymentId} started`);
    // node sends to receiver
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
      this.cfCoreService.getAppInfoByName(appName).appDefinitionAddress,
    );
    const result = normalizeSignedTransferAppState<T>(app);
    this.log.info(`findReceiverAppByPaymentId ${paymentId} completed: ${JSON.stringify(result)}`);
    return result;
  }
}
