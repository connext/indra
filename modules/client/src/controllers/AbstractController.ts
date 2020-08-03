import {
  EventNames,
  IChannelProvider,
  ILoggerService,
  INodeApiClient,
  MethodParams,
  CF_METHOD_TIMEOUT,
  EventPayloads,
  GenericMessage,
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
        `Insufficient funds. Free balance: ${freeBalance[
          this.connext.signerAddress
        ].toString()}, Required balance: ${params.initiatorDeposit.toString()}`,
      );
    }

    // if propose protocol fails on the initiator side, this will hard error
    // so no need to wait for event
    const registryInfo = this.connext.appRegistry.find(
      (a) => a.appDefinitionAddress === params.appDefinition,
    );
    this.log.debug(`Proposing install of ${registryInfo.name}`);
    const { appIdentityHash } = await this.connext.proposeInstallApp(params);
    this.log.debug(`App instance successfully proposed: ${appIdentityHash}`);

    // wait for reject/install message from node, or protocol failures
    const res = (await Promise.race([
      this.listener.waitFor(
        EventNames.INSTALL_FAILED_EVENT,
        CF_METHOD_TIMEOUT * 3,
        (msg) => msg.params.proposal.identityHash === appIdentityHash,
      ),
      this.listener.waitFor(
        EventNames.REJECT_INSTALL_EVENT,
        CF_METHOD_TIMEOUT * 3,
        (msg) => msg.appInstance.identityHash === appIdentityHash,
      ),
      new Promise((resolve) => {
        const subject = `${this.connext.nodeIdentifier}.channel.${this.connext.multisigAddress}.app-instance.${appIdentityHash}.install`;
        this.connext.node.messaging.subscribe(subject, (msg: GenericMessage) => resolve(undefined));
      }),
    ])) as undefined | EventPayloads.InstallFailed | EventPayloads.RejectInstall;
    if (!!res) {
      throw new Error(
        `Failed to install app: ${
          res["error"] || "Node rejected install: " + res["reason"]
        }. Identity hash: ${appIdentityHash}`,
      );
    }
    this.log.info(`Installed app with id: ${appIdentityHash}`);
    return appIdentityHash;
  };

  public throwIfAny = (...maybeErrorMessages: Array<string | undefined>): void => {
    const errors = maybeErrorMessages.filter((c) => !!c);
    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }
  };
}
