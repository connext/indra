import { MultisigCommitment, ConditionalTransactionDelegateTarget } from "@connext/contracts";
import {
  MultisigTransaction,
  MultisigOperation,
  NetworkContext,
  ContractAddresses,
} from "@connext/types";
import { BigNumberish, utils } from "ethers";

const { Interface } = utils;

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);
export class WithdrawCommitment extends MultisigCommitment {
  public constructor(
    public readonly networkContext: NetworkContext | ContractAddresses,
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly recipient: string,
    public readonly assetId: string,
    public readonly amount: BigNumberish,
    public readonly nonce: string,
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      to: this.networkContext.ConditionalTransactionDelegateTarget,
      value: 0,
      data: iface.encodeFunctionData("withdrawWrapper", [
        this.recipient,
        this.assetId,
        this.amount,
        this.nonce,
      ]),
      operation: MultisigOperation.DelegateCall,
    };
  }
}
