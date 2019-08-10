import { AllowedSwap, KnownNodeAppNames } from "@connext/types";
import { ProposeMessage, ProposeVirtualMessage } from "@counterfactual/node";
import { Node as NodeTypes } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { bigNumberify, formatEther } from "ethers/utils";

import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { NodeService } from "../node/node.service";
import { SwapRateService } from "../swapRate/swapRate.service";
import { CLogger, freeBalanceAddressFromXpub } from "../util";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryService");

const ALLOWED_DISCREPANCY_PCT = 5;

@Injectable()
export class AppRegistryService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly swapRateService: SwapRateService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
    private readonly channelService: ChannelService,
  ) {}

  /**
   * Validate apps that are proposed to be installed on the node by clients and
   * accept or reject the install.
   * @param data Data from CF event PROPOSE_INSTALL
   */
  async installOrReject(
    data: ProposeMessage,
  ): Promise<NodeTypes.InstallResult | NodeTypes.RejectInstallResult> {
    try {
      await this.verifyAppProposal(data.data);
      return await this.nodeService.installApp(data.data.appInstanceId);
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting install`);
      console.error(e);
      return await this.nodeService.rejectInstallApp(data.data.appInstanceId);
    }
  }

  /**
   * Reject app installs for virtual apps that node is intermediary of
   * based on invalid conditions.
   * @param data Data from CF event PROPOSE_INSTALL_VIRTUAL
   */
  async rejectVirtual(data: ProposeVirtualMessage): Promise<void | NodeTypes.RejectInstallResult> {
    try {
      await this.verifyVirtualAppProposal(data.data);
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting virtual install`);
      console.error(e);
      return await this.nodeService.rejectInstallApp(data.data.appInstanceId);
    }
  }

  private async appProposalMatchesRegistry(
    proposal: NodeTypes.ProposeInstallParams,
  ): Promise<AppRegistry> {
    const registryAppInfo = await this.appRegistryRepository.findByAppDefinitionAddress(
      proposal.appDefinition,
    );

    if (!registryAppInfo) {
      throw new Error(`App does not exist in registry for definition ${proposal.appDefinition}`);
    }

    if (
      !(
        proposal.appDefinition === registryAppInfo.appDefinitionAddress &&
        proposal.abiEncodings.actionEncoding === registryAppInfo.actionEncoding &&
        proposal.abiEncodings.stateEncoding === registryAppInfo.stateEncoding
      )
    ) {
      throw new Error(
        `Proposed app details ${JSON.stringify(proposal)} do not match registry ${JSON.stringify(
          registryAppInfo,
        )}`,
      );
    }

    return registryAppInfo;
  }

  private async validateTransfer(params: NodeTypes.ProposeInstallVirtualParams): Promise<void> {
    // check if there is sufficient collateral in the channel
    const recipientXpub = params.proposedToIdentifier;
    const recipientChan = await this.channelRepository.findByUserPublicIdentifier(recipientXpub);
    if (!recipientChan) {
      throw new Error(`No open channel found with recipient ${recipientXpub}`);
    }

    const recipientFreeBal = await this.nodeService.getFreeBalance(
      recipientXpub,
      recipientChan.multisigAddress,
      params.initiatorDepositTokenAddress,
    );

    const collateralAvailable =
      recipientFreeBal[freeBalanceAddressFromXpub(recipientChan.nodePublicIdentifier)];

    if (collateralAvailable.lt(params.initiatorDeposit)) {
      // TODO: best way to handle case where user is sending payment
      // *above* amounts specified in the payment profile
      await this.channelService.requestCollateral(
        params.proposedToIdentifier,
        params.initiatorDepositTokenAddress,
      );
      throw new Error(
        `Insufficient collateral detected in responders channel, ` +
          `retry after channel has been collateralized.`,
      );
    }
  }

  private async validateSwap(params: NodeTypes.ProposeInstallParams): Promise<void> {
    const validSwaps = await this.swapRateService.getValidSwaps();
    if (
      !validSwaps.find(
        (swap: AllowedSwap) =>
          swap.from === params.initiatorDepositTokenAddress &&
          swap.to === params.responderDepositTokenAddress,
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
    const derivedRate =
      parseFloat(formatEther(params.responderDeposit)) /
      parseFloat(formatEther(params.initiatorDeposit));

    const ourRate = parseFloat(
      await this.swapRateService.getOrFetchRate(
        params.initiatorDepositTokenAddress,
        params.responderDepositTokenAddress,
      ),
    );
    const discrepancy = Math.abs(ourRate - derivedRate);
    const discrepancyPct = (discrepancy * 100) / ourRate;

    if (discrepancyPct > ALLOWED_DISCREPANCY_PCT) {
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
    const registryAppInfo = await this.appProposalMatchesRegistry(proposedAppParams.params);

    if (!registryAppInfo.allowNodeInstall) {
      throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
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

  private async verifyVirtualAppProposal(proposedAppParams: {
    params: NodeTypes.ProposeInstallVirtualParams;
    appInstanceId: string;
  }): Promise<void> {
    const registryAppInfo = await this.appProposalMatchesRegistry(proposedAppParams.params);

    switch (registryAppInfo.name) {
      case KnownNodeAppNames.UNIDIRECTIONAL_TRANSFER:
        await this.validateTransfer(proposedAppParams.params);
        break;
      default:
        break;
    }
    logger.log(`Validation completed for app ${registryAppInfo.name}`);
  }
}
