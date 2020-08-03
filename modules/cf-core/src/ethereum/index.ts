import {
  MultisigCommitment,
  ConditionalTransactionCommitment,
  SetStateCommitment,
  SetupCommitment,
} from "@connext/contracts";
import { OutcomeType, NetworkContext } from "@connext/types";
import { toBN } from "@connext/utils";
import { constants } from "ethers";

import { StateChannel, AppInstance } from "../models";
import { Context } from "../types";

const { AddressZero } = constants;

const getConditionalTransactionCommitment = (
  network: NetworkContext,
  stateChannel: StateChannel,
  appInstance: AppInstance,
): ConditionalTransactionCommitment =>
  new ConditionalTransactionCommitment(
    network.contractAddresses,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    appInstance.identityHash,
    stateChannel.freeBalance.identityHash,
    appInstance.outcomeType === OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER
      ? network.contractAddresses.MultiAssetMultiPartyCoinTransferInterpreter
      : appInstance.outcomeType === OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER
      ? network.contractAddresses.SingleAssetTwoPartyCoinTransferInterpreter
      : appInstance.outcomeType === OutcomeType.TWO_PARTY_FIXED_OUTCOME
      ? network.contractAddresses.TwoPartyFixedOutcomeInterpreter
      : AddressZero,
    appInstance.encodedInterpreterParams,
  );

const getSetStateCommitment = (network: NetworkContext, appInstance: AppInstance) =>
  new SetStateCommitment(
    network.contractAddresses.ChallengeRegistry,
    appInstance.identity,
    appInstance.hashOfLatestState,
    toBN(appInstance.versionNumber),
    toBN(appInstance.stateTimeout),
  );

const getSetupCommitment = (network: NetworkContext, stateChannel: StateChannel): SetupCommitment =>
  new SetupCommitment(
    network.contractAddresses,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    stateChannel.freeBalance.identity,
  );

export {
  MultisigCommitment,
  getConditionalTransactionCommitment,
  ConditionalTransactionCommitment,
  getSetStateCommitment,
  SetStateCommitment,
  getSetupCommitment,
  SetupCommitment,
};
