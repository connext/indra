import { MultisigCommitment, ConditionalTransactionDelegateTarget } from "@connext/contracts";
import { MultisigTransaction, MultisigOperation, ContractAddresses } from "@connext/types";
import { BigNumberish, Interface } from "ethers/utils";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);
export class WithdrawCommitment extends MultisigCommitment {
  public constructor(
    public readonly contractAddresses: ContractAddresses,
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
      to: this.contractAddresses.ConditionalTransactionDelegateTarget,
      value: 0,
      data: iface.functions.withdrawWrapper.encode([
        this.recipient,
        this.assetId,
        this.amount,
        this.nonce,
      ]),
      operation: MultisigOperation.DelegateCall,
    };
  }
}
