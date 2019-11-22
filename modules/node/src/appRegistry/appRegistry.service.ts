import {
  AllowedSwap,
  CoinTransfer,
  SimpleLinkedTransferAppStateBigNumber,
  SimpleTransferAppStateBigNumber,
  SupportedApplications,
} from "@connext/types";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber, bigNumberify, formatEther } from "ethers/utils";

import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { SwapRateService } from "../swapRate/swapRate.service";
import { TransferService } from "../transfer/transfer.service";
import {
  bigNumberifyObj,
  CLogger,
  freeBalanceAddressFromXpub,
  isEthAddress,
  normalizeEthAddresses,
  stringify,
} from "../util";
import { CFCoreTypes, ProposeMessage } from "../util/cfCore";

import { AppRegistry } from "./appRegistry.entity";
import { AppRegistryRepository } from "./appRegistry.repository";

const logger = new CLogger("AppRegistryService");

const ALLOWED_DISCREPANCY_PCT = 5;

@Injectable()
export class AppRegistryService {
  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly swapRateService: SwapRateService,
    private readonly channelService: ChannelService,
    private readonly transferService: TransferService,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly channelRepository: ChannelRepository,
  ) {}

  /**
   * Validate apps that are proposed to be installed on the node by clients and
   * accept or reject the install.
   * @param data Data from CF event PROPOSE_INSTALL
   */
  async allowOrReject(data: ProposeMessage): Promise<AppRegistry | void> {
    try {
      // TODO: remove any casting when #573 is merged
      const registryAppInfo = await this.verifyAppProposal(data.data as any, data.from);
      await this.cfCoreService.installApp(data.data.appInstanceId);
      return registryAppInfo;
    } catch (e) {
      logger.error(`Caught error during proposed app validation, rejecting install`);
      console.error(e);
      await this.cfCoreService.rejectInstallApp(data.data.appInstanceId);
      return;
    }
  }

  async appProposalMatchesRegistry(
    proposal: CFCoreTypes.ProposeInstallParams,
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
        `Proposed app details ${stringify(proposal)} do not match registry ${stringify(
          registryAppInfo,
        )}`,
      );
    }

    return registryAppInfo;
  }

  // should validate any of the transfer-specific conditions,
  // specifically surrounding the initial state of the applications
  private async validateTransfer(params: CFCoreTypes.ProposeInstallParams): Promise<void> {
    // perform any validation that is relevant to both virtual
    // and ledger applications sent from a client
    const {
      initialState: initialStateBadType,
      initiatorDeposit,
      responderDeposit,
    } = normalizeEthAddresses(bigNumberifyObj(params));
    if (!responderDeposit.isZero()) {
      throw new Error(`Cannot install virtual transfer app with a nonzero responder deposit.`);
    }

    if (!initiatorDeposit.gt(Zero)) {
      throw new Error(`Cannot install a transfer app with an initiator deposit greater than zero`);
    }

    // validate the initial state is kosher
    const initialState = bigNumberifyObj(initialStateBadType) as SimpleTransferAppStateBigNumber;

    // transfers[0] is the senders value in the array, and the transfers[1]
    // is the recipients value in the array
    if (
      bigNumberify(initialState.coinTransfers[0].amount).lt(Zero) ||
      !bigNumberify(initialState.coinTransfers[0].amount).eq(initiatorDeposit)
    ) {
      throw new Error(
        `Cannot install a transfer app with initiator deposit values that are ` +
          `different in the initial state than the params.`,
      );
    }

    if (!bigNumberify(initialState.coinTransfers[1].amount).isZero()) {
      throw new Error(
        `Cannot install a transfer app with nonzero values for the recipient in the initial state.`,
      );
    }
  }

  private async validateSwap(params: CFCoreTypes.ProposeInstallParams): Promise<void> {
    const {
      initiatorDeposit,
      initiatorDepositTokenAddress,
      responderDeposit,
      responderDepositTokenAddress,
    } = normalizeEthAddresses(bigNumberifyObj(params));

    const validSwaps = await this.swapRateService.getValidSwaps();
    if (
      !validSwaps.find(
        (swap: AllowedSwap) =>
          swap.from === initiatorDepositTokenAddress && swap.to === responderDepositTokenAddress,
      )
    ) {
      throw new Error(
        `Swap from ${initiatorDepositTokenAddress} to ` +
          `${responderDepositTokenAddress} is not valid. Valid swaps: ${stringify(validSwaps)}`,
      );
    }

    // |our rate - derived rate| / our rate = discrepancy
    const derivedRate =
      parseFloat(formatEther(responderDeposit)) / parseFloat(formatEther(initiatorDeposit));

    const ourRate = parseFloat(
      await this.swapRateService.getOrFetchRate(
        initiatorDepositTokenAddress,
        responderDepositTokenAddress,
      ),
    );
    const discrepancy = Math.abs(ourRate - derivedRate);
    const discrepancyPct = (discrepancy * 100) / ourRate;

    if (discrepancyPct > ALLOWED_DISCREPANCY_PCT) {
      throw new Error(
        `Derived rate is ${derivedRate.toString()} (vs ${ourRate}), more than ${ALLOWED_DISCREPANCY_PCT}% ` +
          `larger discrepancy than our rate of ${ourRate.toString()}`,
      );
    }

    logger.log(
      `Derived rate is ${derivedRate.toString()}, within ${ALLOWED_DISCREPANCY_PCT}% ` +
        `of our rate ${ourRate.toString()}`,
    );
  }

  private async validateSimpleLinkedTransfer(
    params: CFCoreTypes.ProposeInstallParams,
  ): Promise<void> {
    const {
      responderDeposit,
      initiatorDeposit,
      initialState: initialStateBadType,
    } = bigNumberifyObj(params);

    const initialState = bigNumberifyObj(
      initialStateBadType,
    ) as SimpleLinkedTransferAppStateBigNumber;

    initialState.coinTransfers = initialState.coinTransfers.map(
      (transfer: CoinTransfer<BigNumber>) => bigNumberifyObj(transfer),
    ) as any;

    if (responderDeposit.gt(Zero)) {
      throw new Error(
        `Will not accept linked transfer install where node deposit is >0 ${stringify(params)}`,
      );
    }

    if (initiatorDeposit.lte(Zero)) {
      throw new Error(
        `Will not accept linked transfer install where initiator deposit is <=0 ${stringify(
          params,
        )}`,
      );
    }

    if (!initialState.amount.eq(initiatorDeposit)) {
      throw new Error(`Payment amount bust be the same as initiator deposit ${stringify(params)}`);
    }

    if (bigNumberify(initialState.coinTransfers[0].amount).lte(Zero)) {
      throw new Error(
        `Cannot install a linked transfer app with a sender transfer of <= 0. Transfer amount: ${bigNumberify(
          initialState.coinTransfers[0].amount,
        ).toString()}`,
      );
    }

    if (bigNumberify(initialState.coinTransfers[1].amount).lt(Zero)) {
      throw new Error(
        `Cannot install a linked transfer app with a redeemer transfer of < 0. Transfer amount: ${bigNumberify(
          initialState.coinTransfers[1].amount,
        ).toString()}`,
      );
    }

    if (
      !bigNumberify(initialState.coinTransfers[0].amount).eq(initiatorDeposit) ||
      !bigNumberify(initialState.coinTransfers[1].amount).eq(responderDeposit)
    ) {
      throw new Error(`Mismatch between deposits and initial state, refusing to install.`);
    }
  }

  private async commonAppProposalValidation(
    params: CFCoreTypes.ProposeInstallParams,
    initiatorIdentifier: string,
  ): Promise<void> {
    const {
      initiatorDeposit,
      initiatorDepositTokenAddress,
      responderDeposit,
      responderDepositTokenAddress,
      timeout,
      proposedToIdentifier,
    } = normalizeEthAddresses(bigNumberifyObj(params));

    if (timeout.lt(Zero)) {
      throw new Error(`"timeout" in params cannot be negative`);
    }

    if (initiatorDeposit.lt(Zero) || bigNumberify(responderDeposit).lt(Zero)) {
      throw new Error(`Cannot have negative initiator or responder deposits into applications.`);
    }

    if (responderDepositTokenAddress && !isEthAddress(responderDepositTokenAddress)) {
      throw new Error(`Invalid "responderDepositTokenAddress" provided`);
    }

    if (initiatorDepositTokenAddress && !isEthAddress(initiatorDepositTokenAddress)) {
      throw new Error(`Invalid "initiatorDepositTokenAddress" provided`);
    }

    // NOTE: may need to remove this condition if we start working
    // with games
    if (responderDeposit.isZero() && initiatorDeposit.isZero()) {
      throw new Error(
        `Cannot install an app with zero valued deposits for both initiator and responder.`,
      );
    }

    // make sure initiator has sufficient funds
    const initiatorChannel = await this.channelRepository.findByUserPublicIdentifier(
      initiatorIdentifier,
    );
    const freeBalanceInitiatorAsset = await this.cfCoreService.getFreeBalance(
      initiatorIdentifier,
      initiatorChannel.multisigAddress,
      initiatorDepositTokenAddress,
    );
    const initiatorFreeBalance =
      freeBalanceInitiatorAsset[freeBalanceAddressFromXpub(initiatorIdentifier)];
    if (initiatorFreeBalance.lt(initiatorDeposit)) {
      throw new Error(
        `Initiator has insufficient funds to install proposed app. Initiator free balance: ${initiatorFreeBalance.toString()}, deposit requested: ${initiatorDeposit.toString()}`,
      );
    }

    // make sure that the node has sufficient balance for requested deposit
    const nodeIsResponder = proposedToIdentifier === this.cfCoreService.cfCore.publicIdentifier;
    let freeBalanceResponderAsset: CFCoreTypes.GetFreeBalanceStateResult;
    if (nodeIsResponder) {
      freeBalanceResponderAsset = await this.cfCoreService.getFreeBalance(
        initiatorIdentifier,
        initiatorChannel.multisigAddress,
        responderDepositTokenAddress,
      );
    } else {
      const responderChannel = await this.channelRepository.findByUserPublicIdentifier(
        proposedToIdentifier,
      );
      if (!responderChannel) {
        throw new Error(`Could not find channel for user: ${proposedToIdentifier}`);
      }
      freeBalanceResponderAsset = await this.cfCoreService.getFreeBalance(
        proposedToIdentifier,
        responderChannel.multisigAddress,
        responderDepositTokenAddress,
      );
    }
    const balAvailable =
      freeBalanceResponderAsset[freeBalanceAddressFromXpub(proposedToIdentifier)];
    if (balAvailable.lt(responderDeposit)) {
      throw new Error(`Node has insufficient balance to install the app with proposed deposit.`);
    }
  }

  // should perform validation on everything all generic app conditions that
  // must be satisfied when installing a virtual or ledger app, including:
  // - matches registry information
  // - non-negative timeout
  // - non-negative deposits
  // - valid token addresses
  // - apps have value --> maybe not for games?
  // - sufficient collateral in recipients channel (if virtual)
  // - sufficient free balance from initiator
  // - sufficient free balance from node (if ledger)

  // TODO: there is a lot of duplicate logic here + client. ideally, much
  // of this would be moved to a shared library.
  private async verifyAppProposal(
    proposedAppParams: {
      params: CFCoreTypes.ProposeInstallParams;
      appInstanceId: string;
    },
    initiatorIdentifier: string,
  ): Promise<AppRegistry | void> {
    const myIdentifier = this.cfCoreService.cfCore.publicIdentifier;
    if (initiatorIdentifier === myIdentifier) {
      logger.log(`Received proposal from our own node.`);
      return;
    }

    const registryAppInfo = await this.appProposalMatchesRegistry(proposedAppParams.params);

    if (!registryAppInfo.allowNodeInstall) {
      throw new Error(`App ${registryAppInfo.name} is not allowed to be installed on the node`);
    }

    logger.log(`App with params ${stringify(proposedAppParams.params, 2)} allowed to be installed`);

    await this.commonAppProposalValidation(proposedAppParams.params, initiatorIdentifier);

    switch (registryAppInfo.name) {
      case SupportedApplications.SimpleTwoPartySwapApp:
        await this.validateSwap(proposedAppParams.params);
        break;
      // TODO: add validation of simple transfer validateSimpleTransfer
      case SupportedApplications.SimpleLinkedTransferApp:
        await this.validateSimpleLinkedTransfer(proposedAppParams.params);
        break;
      default:
        break;
    }
    logger.log(`Validation completed for app ${registryAppInfo.name}`);
    return registryAppInfo;
  }

  // TODO: will need to remove this
  private async verifyVirtualAppProposal(
    proposedAppParams: {
      params: CFCoreTypes.ProposeInstallParams;
      appInstanceId: string;
    },
    initiatorIdentifier: string,
  ): Promise<void> {
    const {
      initiatorDeposit,
      initiatorDepositTokenAddress,
      proposedToIdentifier,
    } = bigNumberifyObj(proposedAppParams.params);

    const registryAppInfo = await this.appProposalMatchesRegistry(proposedAppParams.params);

    if (registryAppInfo.name !== "SimpleTransferApp") {
      logger.debug(
        `Caught propose install virtual for what should always be a regular app. CF should also emit a virtual app install event, so let this callback handle and verify. Will need to refactor soon!`,
      );
      return;
    }

    await this.commonAppProposalValidation(proposedAppParams.params, initiatorIdentifier);

    // check if there is sufficient collateral in the channel
    const recipientChan = await this.channelRepository.findByUserPublicIdentifier(
      proposedAppParams.params.proposedToIdentifier,
    );

    const collateralFreeBal = await this.cfCoreService.getFreeBalance(
      proposedToIdentifier,
      recipientChan.multisigAddress,
      initiatorDepositTokenAddress,
    );

    const collateralAvailable = collateralFreeBal[this.cfCoreService.cfCore.freeBalanceAddress];

    if (collateralAvailable.lt(initiatorDeposit)) {
      // TODO: best way to handle case where user is sending payment
      // *above* amounts specified in the payment profile
      // also, do we want to request collateral in a different location?
      await this.channelService.requestCollateral(
        proposedToIdentifier,
        initiatorDepositTokenAddress,
        initiatorDeposit,
      );
      throw new Error(
        `Insufficient collateral detected in responders channel, ` +
          `retry after channel has been collateralized.`,
      );
    }

    switch (registryAppInfo.name) {
      case SupportedApplications.SimpleTransferApp:
        // TODO: move this to install
        // TODO: this doesn't work with the new paradigm, we won't know this info
        await this.transferService.savePeerToPeerTransfer(
          initiatorIdentifier,
          proposedAppParams.params.proposedToIdentifier,
          proposedAppParams.params.initiatorDepositTokenAddress,
          bigNumberify(proposedAppParams.params.initiatorDeposit),
          proposedAppParams.appInstanceId,
          proposedAppParams.params.meta,
        );
        break;
      default:
        break;
    }
    logger.log(`Validation completed for app ${registryAppInfo.name}`);
  }
}
