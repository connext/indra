import { CFCoreTypes, IChannelProvider } from "@connext/types";
import { providers } from "ethers";

import { ConnextClient } from "../connext";
import { CF_METHOD_TIMEOUT, delayAndThrow, Logger, stringify } from "../lib";
import { ConnextListener } from "../listener";
import { INodeApiClient } from "../types";

export abstract class AbstractController {
  public name: string;
  public connext: ConnextClient;
  public log: Logger;
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
    this.log = new Logger(name, connext.log.logLevel);
    this.ethProvider = connext.ethProvider;
  }

  proposeAndInstallLedgerApp = async (
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<string> => {
    const { appInstanceId } = await this.connext.proposeInstallApp(params);

    let boundResolve: (value?: any) => void;
    let boundReject: (reason?: any) => void;

    try {
      const res = await Promise.race([
        new Promise((res: () => any, rej: () => any): void => {
          boundResolve = this.resolveInstall.bind(null, res, rej, appInstanceId);
          boundReject = this.rejectInstall.bind(null, rej, appInstanceId);
          this.log.debug(
            `subscribing to indra.node.${this.connext.nodePublicIdentifier}.install.${this.connext.multisigAddress}`,
          );
          this.connext.messaging.subscribe(
            `indra.node.${this.connext.nodePublicIdentifier}.install.${appInstanceId}`,
            boundResolve,
          );
          this.listener.on(CFCoreTypes.EventNames.REJECT_INSTALL_EVENT, boundReject);
        }),
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App install took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
      ]);

      this.log.info(`Installed app ${appInstanceId}`);
      this.log.debug(`Installed app details: ${stringify(res as object)}`);
      return appInstanceId;
    } catch (e) {
      this.log.error(`Error installing app: ${e.stack || e.message}`);
      throw new Error(e.stack || e.message);
    } finally {
      this.cleanupInstallListeners(boundReject, appInstanceId);
    }
  };

  proposeAndWaitForAccepted = async (params: CFCoreTypes.ProposeInstallParams): Promise<string> => {
    let boundReject: (reason?: any) => void;
    let appId: string;

    try {
      await Promise.race([
        new Promise(
          async (res: () => any, rej: () => any): Promise<void> => {
            boundReject = this.rejectProposal.bind(null, rej);
            this.log.debug(
              `subscribing to indra.node.${this.connext.nodePublicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
            );
            this.connext.messaging.subscribe(
              `indra.node.${this.connext.nodePublicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
              res,
            );
            const { appInstanceId } = await this.connext.proposeInstallApp(params);
            appId = appInstanceId;
            this.log.debug(`waiting for proposal acceptance of ${appInstanceId}`);
            this.listener.on(CFCoreTypes.EventNames.REJECT_INSTALL_EVENT, boundReject);
          },
        ),
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App proposal took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
      ]);
      this.log.info(`App was proposed successfully!: ${appId}`);
      return appId;
    } catch (e) {
      this.log.error(`Error proposing app: ${e.stack || e.message}`);
      throw new Error(e.stack || e.message);
    } finally {
      this.cleanupProposalListeners(boundReject);
    }
  };

  private resolveInstall = (
    res: (value?: unknown) => void,
    rej: (message?: Error) => void,
    appInstanceId: string,
    message: any,
  ): void => {
    // TODO: why is it sometimes data vs data.data?
    const appInstance = message.data.data ? message.data.data : message.data;

    if (appInstance.identityHash !== appInstanceId) {
      // not our app
      const msg = `Caught install event for different app ${stringify(
        message,
      )}, expected ${appInstanceId}. This should not happen.`;
      this.log.warn(msg);
      return rej(new Error(msg));
    }
    res(message);
  };

  private rejectInstall = (
    rej: (message?: Error) => void,
    appInstanceId: string,
    message: any,
  ): void => {
    // check app id
    const data = message.data && message.data.data ? message.data.data : message.data || message;
    if (data.appInstanceId !== appInstanceId) {
      const msg = `Caught reject install event for different app ${stringify(
        message,
      )}, expected ${appInstanceId}. This should not happen.`;
      this.log.warn(msg);
      return rej(new Error(msg));
    }

    return rej(new Error(`Install failed. Event data: ${stringify(message)}`));
  };

  private rejectProposal = (
    rej: (reason?: Error) => void,
    msg: CFCoreTypes.RejectInstallEventData,
  ): void => {
    return rej(new Error(`Proposal rejected, event data: ${stringify(msg)}`));
  };

  private cleanupInstallListeners = (boundReject: any, appId: string): void => {
    this.connext.messaging.unsubscribe(
      `indra.node.${this.connext.nodePublicIdentifier}.install.${appId}`,
    );
    this.listener.removeCfListener("REJECT_INSTALL_EVENT", boundReject);
  };

  private cleanupProposalListeners = (boundReject: any): void => {
    this.connext.messaging.unsubscribe(
      `indra.node.${this.connext.nodePublicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
    );
    this.listener.removeCfListener("REJECT_INSTALL_EVENT" as CFCoreTypes.EventName, boundReject);
  };
}
