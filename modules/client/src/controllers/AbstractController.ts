import {
  EventNames,
  IChannelProvider,
  ILoggerService,
  INodeApiClient,
  MethodParams,
} from "@connext/types";
import { stringify } from "@connext/utils";
import { providers } from "ethers";

import { ConnextClient } from "../connext";
import { ConnextListener } from "../listener";

export abstract class AbstractController {
  public name: string;
  public connext: ConnextClient;
  public log: ILoggerService;
  public node: INodeApiClient;
  public channelProvider: IChannelProvider;
  public listener: ConnextListener;
  public ethProvider: providers.JsonRpcProvider;

  public constructor(name: string, connext: ConnextClient) {
    this.connext = connext;
    this.name = name;
    this.node = connext.node;
    this.channelProvider = connext.channelProvider;
    this.listener = connext.listener;
    this.log = connext.log.newContext(name);
    this.ethProvider = connext.ethProvider;
  }

  /**
   * @returns {string} appIdentityHash - Installed app's identityHash
   */
  public proposeAndInstallLedgerApp = async (
    params: MethodParams.ProposeInstall,
  ): Promise<string> => {
    // 163 ms
    this.log.info(`Calling propose install`);
    this.log.debug(`Calling propose install with ${stringify(params)}`);

    // Temporarily validate this here until we move it into propose protocol as  part of other PRs.
    // Without this, install will fail with a timeout
    const freeBalance = await this.connext.getFreeBalance(params.initiatorDepositAssetId);
    if (params.initiatorDeposit.gt(freeBalance[this.connext.signerAddress])) {
      throw new Error(
        `Insufficient funds. Free balance: ${freeBalance.toString()}, Required balance: ${params.initiatorDeposit.toString()}`,
      );
    }

    // if propose protocol fails on the initiator side, this will hard error
    // so no need to wait for event
    const { appIdentityHash } = await this.connext.proposeInstallApp(params);
    this.log.debug(`App instance successfully proposed`);

    let boundReject: (reason?: any) => void;
    let boundInstallFailed: (reason?: any) => void;

    try {
      // 1676 ms TODO: why does this step take so long?
      await Promise.race([
        new Promise((resolve, reject) => {
          boundInstallFailed = this.rejectInstall.bind(null, reject, appIdentityHash);
          this.listener.on(EventNames.INSTALL_FAILED_EVENT, boundInstallFailed);
        }),
        new Promise((resolve, reject) => {
          boundReject = this.rejectInstall.bind(null, reject, appIdentityHash);
          this.listener.on(EventNames.REJECT_INSTALL_EVENT, boundReject);
        }),
        new Promise((resolve) => {
          // set up install nats subscription
          const subject = `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`;
          this.connext.node.messaging.subscribe(subject, resolve);
        }),
      ]);

      this.log.info(`Installed app with id: ${appIdentityHash}`);
      return appIdentityHash;
    } catch (e) {
      console.error(`caught error: ${e.message}`);
      this.log.error(`Error installing app: ${e.stack || e.message}`);
      throw e;
    } finally {
      this.cleanupInstallListeners(boundReject, boundInstallFailed, appIdentityHash);
    }
  };

  public throwIfAny = (...maybeErrorMessages: Array<string | undefined>): void => {
    const errors = maybeErrorMessages.filter((c) => !!c);
    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  };

  private rejectInstall = (
    rej: (message?: Error) => void,
    appIdentityHash: string,
    message: any,
  ): void => {
    // check app id
    const data = message.data && message.data.data ? message.data.data : message.data || message;
    if (data.appIdentityHash === appIdentityHash) {
      return rej(new Error(`Install failed. Event data: ${stringify(message)}`));
    }
    return;
  };

  private cleanupInstallListeners = (
    boundReject: any,
    boundInstallFailed: any,
    appIdentityHash: string,
  ): void => {
    this.connext.node.messaging.unsubscribe(
      `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`,
    );
    this.listener.removeCfListener(EventNames.REJECT_INSTALL_EVENT, boundReject);
    this.listener.removeCfListener(EventNames.INSTALL_FAILED_EVENT, boundInstallFailed);
  };
}
