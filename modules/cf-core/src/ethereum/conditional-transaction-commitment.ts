import { Interface, Signature } from "ethers/utils";

import { ConditionalTransactionDelegateTarget } from "../contracts";
import { ConditionalTransactionCommitmentJSON, MultisigOperation, NetworkContext } from "../types";

import { MultisigCommitment } from "./multisig-commitment";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

/**
 * A class to represent an unsigned multisignature wallet transaction
 * to the ConditionalTransactionDelegateTarget contract.
 * @class
 *
 * @extends {MultisigCommitment}
 */
export class ConditionalTransactionCommitment extends MultisigCommitment {
  constructor(
    public readonly networkContext: NetworkContext,
    public readonly multisig: string,
    public readonly multisigOwners: string[],
    public readonly appIdentityHash: string,
    public readonly freeBalanceAppIdentityHash: string,
    public readonly interpreterAddr: string,
    public readonly interpreterParams: string,
    participantSignatures: Signature[] = [],
  ) {
    super(multisig, multisigOwners, participantSignatures);
  }

  toJson(): ConditionalTransactionCommitmentJSON {
    return {
      appIdentityHash: this.appIdentityHash,
      freeBalanceAppIdentityHash: this.freeBalanceAppIdentityHash,
      interpreterAddr: this.interpreterAddr,
      interpreterParams: this.interpreterParams,
      multisigAddress: this.multisigAddress,
      multisigOwners: this.multisigOwners,
      networkContext: this.networkContext,
      signatures: this.signatures,
    };
  }

  public static fromJson(json: ConditionalTransactionCommitmentJSON) {
    return new ConditionalTransactionCommitment(
      json.networkContext,
      json.multisigAddress,
      json.multisigOwners,
      json.appIdentityHash,
      json.freeBalanceAppIdentityHash,
      json.interpreterAddr,
      json.interpreterParams,
      json.signatures,
    );
  }

  /**
   * Takes parameters for executeEffectOfInterpretedAppOutcome function call and
   * encodes them into a bytes array for the data field of the transaction.
   *
   * @returns The (to, value, data, op) data required by MultisigCommitment
   * @memberof ConditionalTransactionCommitment
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
