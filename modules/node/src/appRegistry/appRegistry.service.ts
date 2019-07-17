import { jsonRpcDeserialize, Node, ProposeMessage } from "@counterfactual/node";
import {
  AppInstanceInfo,
  Node as NodeTypes,
  SolidityABIEncoderV2Type,
} from "@counterfactual/types";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";

import { NodeProviderId } from "../constants";
import { CLogger, registerCfNodeListener } from "../util";

import { AppRegistry } from "./appRegistry.entity";
import { KnownNodeAppNames } from "./appRegistry.module";
import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryService");

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    @Inject(NodeProviderId) private readonly node: Node,
    private readonly appRegistryRepository: AppRegistryRepository,
  ) {}

  private appProposalMatchesRegistry(proposal: AppInstanceInfo, registry: AppRegistry): boolean {
    return (
      proposal.appDefinition === registry.appDefinitionAddress &&
      proposal.abiEncodings.actionEncoding === registry.actionEncoding &&
      proposal.abiEncodings.stateEncoding === registry.stateEncoding
    );
  }

  // TODO: how to match this with type
  private validateSwap(initialState: SolidityABIEncoderV2Type): void {}

  private async verifyAppProposal(proposedAppParams: {
    params: NodeTypes.ProposeInstallParams;
    appInstanceId: string;
  }): Promise<void> {
    const proposedRes = await this.node.rpcRouter.dispatch(
      jsonRpcDeserialize({
        id: Date.now(),
        jsonrpc: "2.0",
        method: NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
        params: {} as NodeTypes.GetProposedAppInstancesParams,
      }),
    );

    const proposedApps = proposedRes.result as NodeTypes.GetProposedAppInstancesResult;
    const proposedAppInfos = proposedApps.appInstances.filter((app: AppInstanceInfo) => {
      return app.identityHash === proposedAppParams.appInstanceId;
    });

    if (proposedAppInfos.length !== 1) {
      throw new Error(
        `Proposed application could not be found, or multiple instances found. Caught id: ${
          proposedAppParams.appInstanceId
        }. Proposed apps: ${JSON.stringify(proposedApps.appInstances, null, 2)}`,
      );
    }

    const proposedAppInfo = proposedAppInfos[0];

    const registryAppInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
      proposedAppInfo.appDefinition,
    );

    if (!registryAppInfo) {
      throw new Error(
        `App does not exist in registry for definition address ${proposedAppInfo.appDefinition}`,
      );
    }

    if (!registryAppInfo.allowNodeInstall) {
      throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
    }

    if (!this.appProposalMatchesRegistry(proposedAppInfo, registryAppInfo)) {
      throw new Error(
        `Proposed app details ${JSON.stringify(
          proposedAppInfo,
        )} does not match registry ${JSON.stringify(registryAppInfo)}`,
      );
    }

    switch (registryAppInfo.name) {
      case KnownNodeAppNames.SIMPLE_TWO_PARTY_SWAP:
        await this.validateSwap(proposedAppParams.params.initialState);
        break;
      default:
        break;
    }
    logger.log(`Validation completed for app ${registryAppInfo.name}`);
  }

  private async installOrReject(
    data: ProposeMessage,
  ): Promise<NodeTypes.InstallResult | NodeTypes.RejectInstallResult> {
    try {
      await this.verifyAppProposal(data.data);
      const installResponse = await this.node.rpcRouter.dispatch(
        jsonRpcDeserialize({
          id: Date.now(),
          jsonrpc: "2.0",
          method: NodeTypes.RpcMethodName.INSTALL,
          params: {
            appInstanceId: data.data.appInstanceId,
          } as NodeTypes.InstallParams,
        }),
      );
      return installResponse.result as NodeTypes.InstallResult;
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting install`);
      logger.error(e);
      const installResponse = await this.node.rpcRouter.dispatch(
        jsonRpcDeserialize({
          id: Date.now(),
          jsonrpc: "2.0",
          method: NodeTypes.RpcMethodName.REJECT_INSTALL,
          params: {
            appInstanceId: data.data.appInstanceId,
          } as NodeTypes.RejectInstallParams,
        }),
      );
      return installResponse.result as NodeTypes.RejectInstallResult;
    }
  }

  private registerNodeListeners(): void {
    registerCfNodeListener(
      this.node,
      NodeTypes.EventName.PROPOSE_INSTALL,
      this.installOrReject,
      logger.cxt,
    );
  }

  onModuleInit(): void {
    this.registerNodeListeners();
  }
}
