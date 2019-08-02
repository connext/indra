import { KnownNodeAppNames } from "@connext/types";
import { ProposeMessage } from "@counterfactual/node";
import { AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Zero } from "ethers/constants";

import { NodeService } from "../node/node.service";
import { CLogger, toBig } from "../util";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryService");

@Injectable()
export class AppRegistryService implements OnModuleInit {
  constructor(
    private readonly nodeService: NodeService,
    private readonly appRegistryRepository: AppRegistryRepository,
  ) {}

  private appProposalMatchesRegistry(proposal: AppInstanceInfo, registry: AppRegistry): boolean {
    return (
      proposal.appDefinition === registry.appDefinitionAddress &&
      proposal.abiEncodings.actionEncoding === registry.actionEncoding &&
      proposal.abiEncodings.stateEncoding === registry.stateEncoding
    );
  }

  private validateSwap(params: NodeTypes.ProposeInstallParams): void {
    console.log("TODO: VALIDATE THIS INITIAL STATE:");
    console.log("params: ", JSON.stringify(params));
  }

  private validateLinkedTransfer(params: NodeTypes.ProposeInstallParams): void {
    if (toBig(params.responderDeposit).gt(Zero)) {
      throw new Error(
        `Will not accept linked transfer install where node deposit is >0 ${JSON.stringify(
          params,
        )}`,
      );
    }
  }

  private async verifyAppProposal(proposedAppParams: {
    params: NodeTypes.ProposeInstallParams;
    appInstanceId: string;
  }): Promise<void> {
    const proposedApps = await this.nodeService.getProposedAppInstances();
    const proposedAppInfos = proposedApps.filter((app: AppInstanceInfo) => {
      return app.identityHash === proposedAppParams.appInstanceId;
    });

    if (
      proposedAppParams.params.proposedToIdentifier !== this.nodeService.cfNode.publicIdentifier
    ) {
      throw new Error(
        `proposedToIdentifier is not node publicIdentifier: ${JSON.stringify(
          proposedAppParams.params,
        )}`,
      );
    }

    if (proposedAppInfos.length !== 1) {
      throw new Error(
        `Proposed application could not be found, or multiple instances found. Caught id: ${
          proposedAppParams.appInstanceId
        }. Proposed apps: ${JSON.stringify(proposedApps, null, 2)}`,
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
        await this.validateSwap(proposedAppParams.params);
        break;
      case KnownNodeAppNames.UNIDIRECTIONAL_LINKED_TRANSFER:
        await this.validateLinkedTransfer(proposedAppParams.params);
        break;
      default:
        break;
    }
    logger.log(`Validation completed for app ${registryAppInfo.name}`);
  }

  private installOrReject = async (
    data: ProposeMessage,
  ): Promise<NodeTypes.InstallResult | NodeTypes.RejectInstallResult> => {
    try {
      await this.verifyAppProposal(data.data);
      return await this.nodeService.installApp(data.data.appInstanceId);
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting install`);
      // TODO: why doesn't logger.error log this?
      console.error(e);
      return await this.nodeService.rejectInstallApp(data.data.appInstanceId);
    }
  };

  private registerNodeListeners(): void {
    this.nodeService.registerCfNodeListener(
      NodeTypes.EventName.PROPOSE_INSTALL,
      this.installOrReject,
      logger.cxt,
    );
  }

  onModuleInit(): void {
    this.registerNodeListeners();
  }
}
