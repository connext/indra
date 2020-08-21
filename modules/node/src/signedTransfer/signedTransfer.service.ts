import {
  SignedTransferStatus,
  SimpleSignedTransferAppName,
  GraphSignedTransferAppName,
} from "@connext/types";
import { bigNumberifyJson } from "@connext/utils";
import { Injectable } from "@nestjs/common";
import { CFCoreService } from "../cfCore/cfCore.service";
import { LoggerService } from "../logger/logger.service";
import { AppInstance } from "../appInstance/appInstance.entity";
import { SignedTransferRepository } from "./signedTransfer.repository";
import { appStatusesToTransferStatus } from "../utils";

type SignedTransferTypes = typeof SimpleSignedTransferAppName | typeof GraphSignedTransferAppName;

const appStatusesToSignedTransferStatus = (
  senderApp?: AppInstance<SignedTransferTypes>,
  receiverApp?: AppInstance<SignedTransferTypes>,
): SignedTransferStatus | undefined => {
  return appStatusesToTransferStatus<SignedTransferTypes>(senderApp, receiverApp);
};

export function normalizeSignedTransferAppState<T extends SignedTransferTypes>(
  app?: AppInstance,
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
    chainId: number,
  ): Promise<{
    senderApp?: AppInstance<T>;
    receiverApp?: AppInstance<T>;
    status?: SignedTransferStatus;
  }> {
    this.log.info(`findSenderAndReceiverAppsWithStatus ${paymentId} started`);
    const senderApp = await this.findSenderAppByPaymentId(paymentId, appName, chainId);
    const receiverApp = await this.findReceiverAppByPaymentId(paymentId, appName, chainId);
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
    chainId: number,
  ): Promise<AppInstance<T> | undefined> {
    this.log.info(`findSenderAppByPaymentId ${paymentId} started`);
    // node receives from sender
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndReceiver(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
      this.cfCoreService.getAppInfoByNameAndChain(appName, chainId).appDefinitionAddress,
    );
    const result = normalizeSignedTransferAppState<T>(app);
    this.log.info(`findSenderAppByPaymentId ${paymentId} completed: ${JSON.stringify(result)}`);
    return result;
  }

  async findReceiverAppByPaymentId<T extends SignedTransferTypes>(
    paymentId: string,
    appName: T,
    chainId: number,
  ): Promise<AppInstance<T> | undefined> {
    this.log.info(`findReceiverAppByPaymentId ${paymentId} started`);
    // node sends to receiver
    const app = await this.signedTransferRepository.findSignedTransferAppByPaymentIdAndSender(
      paymentId,
      this.cfCoreService.cfCore.signerAddress,
      this.cfCoreService.getAppInfoByNameAndChain(appName, chainId).appDefinitionAddress,
    );
    const result = normalizeSignedTransferAppState<T>(app);
    this.log.info(`findReceiverAppByPaymentId ${paymentId} completed: ${JSON.stringify(result)}`);
    return result;
  }
}
