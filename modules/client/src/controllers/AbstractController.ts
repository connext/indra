import {
  EventNames,
  EventPayloads,
  IChannelProvider,
  IChannelSigner,
  ILoggerService,
  INodeApiClient,
  MethodParams,
  MethodResults,
} from "@connext/types";
import { providers } from "ethers";

import { ConnextClient } from "../connext";
import { CF_METHOD_TIMEOUT, delayAndThrow, stringify } from "../lib";
import { ConnextListener } from "../listener";

export abstract class AbstractController {
  public name: string;
  public connext: ConnextClient;
  public log: ILoggerService;
  public node: INodeApiClient;
  public channelProvider: IChannelProvider;
  public listener: ConnextListener;
  public ethProvider: providers.JsonRpcProvider;
  public signer: IChannelSigner;

  public constructor(name: string, connext: ConnextClient) {
    this.connext = connext;
    this.name = name;
    this.node = connext.node;
    this.signer = connext.signer;
    this.channelProvider = connext.channelProvider;
    this.listener = connext.listener;
    this.log = connext.log.newContext(name);
    this.ethProvider = connext.ethProvider;
  }

  /**
   * @returns {string} appIdentityHash - Installed app's identityHash
   */
  proposeAndInstallLedgerApp = async (params: MethodParams.ProposeInstall): Promise<string> => {
    // 163 ms
    const proposeRes = await Promise.race([
      this.connext.proposeInstallApp(params),
      delayAndThrow(
        CF_METHOD_TIMEOUT,
        `App proposal took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
      ),
    ]);
    const { appIdentityHash } = proposeRes as MethodResults.ProposeInstall;

    // let boundResolve: (value?: any) => void;
    let boundReject: (reason?: any) => void;

    try {
      // 1676 ms TODO: why does this step take so long?
      await Promise.race([
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App install took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
        new Promise((res: () => any, rej: () => any): void => {
          // boundResolve = this.resolveInstall.bind(null, res, appIdentityHash);
          boundReject = this.rejectInstall.bind(null, rej, appIdentityHash);

          // set up install nats subscription
          const subject = `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`;
          this.connext.node.messaging.subscribe(subject, res);

          // this.listener.on(INSTALL_EVENT, boundResolve, appIdentityHash);
          this.listener.on(EventNames.REJECT_INSTALL_EVENT, boundReject);
        }),
      ]);

      this.log.info(`Installed app with id: ${appIdentityHash}`);
      // this.log.debug(`Installed app details: ${stringify(res as object)}`);
      return appIdentityHash;
    } catch (e) {
      this.log.error(`Error installing app: ${e.stack || e.message}`);
      throw new Error(e.stack || e.message);
    } finally {
      this.cleanupInstallListeners(boundReject, appIdentityHash);
    }
  };

  // private resolveInstall = (
  //   res: (value?: unknown) => void,
  //   appIdentityHash: string,
  //   message: any,
  // ): void => {
  //   const data = message.data ? message.data : message;
  //   if (data.params.appIdentityHash === appIdentityHash) {
  //     res();
  //   }
  // };

  private rejectInstall = (
    rej: (message?: Error) => void,
    appIdentityHash: string,
    message: any,
  ): void => {
    // check app id
    const data = message.data && message.data.data ? message.data.data : message.data || message;
    if (data.appIdentityHash !== appIdentityHash) {
      const msg = `Caught reject install event for different app ${stringify(
        message,
      )}, expected ${appIdentityHash}. This should not happen.`;
      this.log.warn(msg);
      return rej(new Error(msg));
    }

    return rej(new Error(`Install failed. Event data: ${stringify(message)}`));
  };

  private rejectProposal = (
    rej: (reason?: Error) => void,
    msg: EventPayloads.RejectInstall,
  ): void => {
    return rej(new Error(`Proposal rejected, event data: ${stringify(msg)}`));
  };

  private cleanupInstallListeners = (boundReject: any, appIdentityHash: string): void => {
    this.connext.node.messaging.unsubscribe(
      `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`,
    );
    this.listener.removeCfListener(EventNames.REJECT_INSTALL_EVENT, boundReject);
  };
}
