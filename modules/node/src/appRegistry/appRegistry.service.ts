import { KnownNodeAppNames } from "@connext/types";
import { ProposeMessage } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import { AddressZero, Zero } from "ethers/constants";
import { bigNumberify, parseEther } from "ethers/utils";

import { ConfigService } from "../config/config.service";
import { NodeService } from "../node/node.service";
import { SwapRateService } from "../swapRate/swapRate.service";
import { CLogger } from "../util";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryService");

type AllowedSwap = {
  from: string;
  to: string;
};

type AllowedSwaps = AllowedSwap[];

const ALLOWED_DISCREPANCY_PCT = 5;

@Injectable()
export class AppRegistryService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly configService: ConfigService,
    private readonly swapRateService: SwapRateService,
    private readonly appRegistryRepository: AppRegistryRepository,
  ) {}

  async installOrReject(
    data: ProposeMessage,
  ): Promise<NodeTypes.InstallResult | NodeTypes.RejectInstallResult> {
    try {
      await this.verifyAppProposal(data.data);
      return await this.nodeService.installApp(data.data.appInstanceId);
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting install`);
      // TODO: why doesn't logger.error log this?
      console.error(e);
      return await this.nodeService.rejectInstallApp(data.data.appInstanceId);
    }
  }

  private async getValidSwaps(): Promise<AllowedSwaps> {
    const allowedSwaps: AllowedSwaps = [
      {
        from: await this.configService.getTokenAddress(),
        to: AddressZero,
      },
    ];
    return allowedSwaps;
  }

  private appProposalMatchesRegistry(
    proposal: NodeTypes.ProposeInstallParams,
    registry: AppRegistry,
  ): boolean {
    return (
      proposal.appDefinition === registry.appDefinitionAddress &&
      proposal.abiEncodings.actionEncoding === registry.actionEncoding &&
      proposal.abiEncodings.stateEncoding === registry.stateEncoding
    );
  }

  private async validateSwap(params: NodeTypes.ProposeInstallParams): Promise<void> {
    console.log("params: ", JSON.stringify(params));
    const validSwaps = await this.getValidSwaps();
    if (
      !validSwaps.find(
        (swap: AllowedSwap) =>
          swap.from === params.responderDepositTokenAddress &&
          swap.to === params.initiatorDepositTokenAddress,
      )
    ) {
      throw new Error(
        `Swap from ${params.initiatorDepositTokenAddress} to ` +
          `${params.responderDepositTokenAddress} is not valid. Valid swaps: ${JSON.stringify(
            validSwaps,
          )}`,
      );
    }

    // |our rate - derived rate| / our rate = discrepancy
    const derivedRate = parseEther(
      bigNumberify(params.responderDeposit)
        .div(bigNumberify(params.initiatorDeposit))
        .toString(),
    );

    const ourRate = bigNumberify(await this.swapRateService.getOrFetchRate());
    const discrepancy = ourRate.sub(derivedRate).abs();
    const discrepancyPct = discrepancy.mul(100).div(ourRate);

    if (discrepancyPct.gt(ALLOWED_DISCREPANCY_PCT)) {
      throw new Error(
        `Derived rate is ${derivedRate.toString()}, more than ${ALLOWED_DISCREPANCY_PCT}% ` +
          `larger discrepancy than our rate of ${ourRate.toString()}`,
      );
    }

    logger.log(
      `Derived rate is ${derivedRate.toString()}, within ${ALLOWED_DISCREPANCY_PCT}% ` +
        `of our rate ${ourRate.toString()}`,
    );
  }

  private async validateLinkedTransfer(params: NodeTypes.ProposeInstallParams): Promise<void> {
    if (bigNumberify(params.responderDeposit).gt(Zero)) {
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
    const registryAppInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
      proposedAppParams.params.appDefinition,
    );

    if (!registryAppInfo) {
      throw new Error(
        `App does not exist in registry for definition
        address ${proposedAppParams.params.appDefinition}`,
      );
    }

    if (!registryAppInfo.allowNodeInstall) {
      throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
    }

    if (!this.appProposalMatchesRegistry(proposedAppParams.params, registryAppInfo)) {
      throw new Error(
        `Proposed app details ${JSON.stringify(
          proposedAppParams.params,
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
}
