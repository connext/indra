import {
  EventNames,
  IChannelProvider,
  ILoggerService,
  INodeApiClient,
  MethodParams,
  MethodResults,
} from "@connext/types";
import { delayAndThrow, stringify } from "@connext/utils";
import { providers } from "ethers";

import { ConnextClient } from "../connext";
import { ConnextListener } from "../listener";

const CLIENT_METHOD_TIMEOUT = 90_000;

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

    const proposeRes = await Promise.race([
      this.connext.proposeInstallApp(params),
      delayAndThrow(
        CLIENT_METHOD_TIMEOUT,
        `App proposal took longer than ${CLIENT_METHOD_TIMEOUT / 1000} seconds`,
      ),
    ]);
    const { appIdentityHash } = proposeRes as MethodResults.ProposeInstall;
    this.log.debug(`App instance successfully proposed`);

    let boundReject: (reason?: any) => void;

    try {
      // 1676 ms TODO: why does this step take so long?
      await Promise.race([
        delayAndThrow(
          CLIENT_METHOD_TIMEOUT,
          `App install took longer than ${CLIENT_METHOD_TIMEOUT / 1000} seconds`,
        ),
        new Promise((res: () => any, rej: () => any): void => {
          boundReject = this.rejectInstall.bind(null, rej, appIdentityHash);

          // set up install nats subscription
          const subject = `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`;
          this.connext.node.messaging.subscribe(subject, res);

          // this.listener.on(INSTALL_EVENT, boundResolve, appIdentityHash);
          this.listener.on(EventNames.REJECT_INSTALL_EVENT, boundReject);
        }),
      ]);

      this.log.info(`Installed app with id: ${appIdentityHash}`);
      return appIdentityHash;
    } catch (e) {
      this.log.error(`Error installing app: ${e.stack || e.message}`);
      throw e;
    } finally {
      this.cleanupInstallListeners(boundReject, appIdentityHash);
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

  private cleanupInstallListeners = (boundReject: any, appIdentityHash: string): void => {
    this.connext.node.messaging.unsubscribe(
      `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`,
    );
    this.listener.removeCfListener(EventNames.REJECT_INSTALL_EVENT, boundReject);
  };
}
