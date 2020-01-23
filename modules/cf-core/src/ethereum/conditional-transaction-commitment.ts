import { Interface } from "ethers/utils";

import { ConditionalTransactionDelegateTarget } from "../contracts";
import { MultisigOperation, NetworkContext, DomainSeparator } from "../types";

import { MultisigCommitment } from "./multisig-commitment";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);

/**
 * A class to represent an unsigned multisignature wallet transaction
 * to the ConditionalTransactionDelegateTarget contract.
 * @class
 *
 * @extends {MultisigCommitment}
 */
export class ConditionalTransaction extends MultisigCommitment {
  constructor(
    public readonly networkContext: NetworkContext,
    public readonly multisig: string,
    public readonly multisigOwners: string[],
    public readonly appIdentityHash: string,
    public readonly freeBalanceAppIdentityHash: string,
    public readonly interpreterAddr: string,
    public readonly interpreterParams: string,
    public readonly domainSeparator: DomainSeparator,
    public readonly chainId: number,
    public readonly transactionCount: number
  ) {
    super(multisig, multisigOwners);
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
      domainName: this.domainSeparator.domainName,
      domainVersion: this.domainSeparator.domainVersion,
      chainId: this.chainId,
      domainSalt: this.domainSeparator.domainSalt,
      transactionCount: this.transactionCount
    };
  }
}
