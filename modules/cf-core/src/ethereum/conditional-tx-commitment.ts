import { AddressZero } from "ethers/constants";
import { Interface } from "ethers/utils";

import { ConditionalTransactionDelegateTarget } from "../contracts";
import { AppInstance, StateChannel } from "../models";
import { Context, MultisigOperation, NetworkContext, OutcomeType } from "../types";

import { MultisigCommitment } from "./multisig-commitment";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

export const getConditionalTxCommitment = (
  context: Context,
  stateChannel: StateChannel,
  appInstance: AppInstance,
): ConditionalTxCommitment =>
  new ConditionalTxCommitment(
    context.network,
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    appInstance.identityHash,
    stateChannel.freeBalance.identityHash,
    appInstance.outcomeType === OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER
      ? context.network.MultiAssetMultiPartyCoinTransferInterpreter
      : appInstance.outcomeType === OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER
      ? context.network.SingleAssetTwoPartyCoinTransferInterpreter
      : appInstance.outcomeType === OutcomeType.TWO_PARTY_FIXED_OUTCOME
      ? context.network.TwoPartyFixedOutcomeInterpreter
      : AddressZero,
    appInstance.encodedInterpreterParams,
  );

// class to represent an unsigned multisignature wallet transaction
// to the ConditionalTransactionDelegateTarget contract.
export class ConditionalTxCommitment extends MultisigCommitment {
  constructor(
    public readonly networkContext: NetworkContext,
    public readonly multisig: string,
    public readonly multisigOwners: string[],
    public readonly appIdentityHash: string,
    public readonly freeBalanceAppIdentityHash: string,
    public readonly interpreterAddr: string,
    public readonly interpreterParams: string,
  ) {
    super(multisig, multisigOwners);
    if (interpreterAddr === AddressZero) {
      throw Error("The outcome type in this application logic contract is not supported yet.");
    }
  }

  /**
   * Takes parameters for executeEffectOfInterpretedAppOutcome function call and
   * encodes them into a bytes array for the data field of the transaction.
   *
   * @returns The (to, value, data, op) data required by MultisigCommitment
   * @memberof ConditionalTransaction
   */
  public getTransactionDetails() {
    return {
      to: this.networkContext.ConditionalTransactionDelegateTarget,
      value: 0,
      data: iface.functions.executeEffectOfInterpretedAppOutcome.encode([
        this.networkContext.ChallengeRegistry,
        this.freeBalanceAppIdentityHash,
        this.appIdentityHash,
        this.interpreterAddr,
        this.interpreterParams,
      ]),
      operation: MultisigOperation.DelegateCall,
    };
  }
}
