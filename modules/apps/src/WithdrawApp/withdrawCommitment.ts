import { MultisigCommitment, ConditionalTransactionDelegateTarget } from "@connext/contracts";
import {
  ContractAddresses,
  MultisigOperation,
  MultisigTransaction,
  singleAssetSinglePartyCoinTransferEncoding,
  singleAssetTwoPartyCoinTransferInterpreterParamsEncoding,
} from "@connext/types";
import { utils } from "ethers";

const { defaultAbiCoder, Interface } = utils;

const iface = new Interface(ConditionalTransactionDelegateTarget.abi);
export class WithdrawCommitment extends MultisigCommitment {
  public constructor(
    public readonly contractAddresses: ContractAddresses,
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly recipient: string,
    public readonly assetId: string,
    public readonly amount: utils.BigNumberish,
    public readonly nonce: string,
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    const encodedOutcome: string = defaultAbiCoder.encode(
      [singleAssetSinglePartyCoinTransferEncoding],
      [{ to: this.recipient, amount: this.amount }]
    );
    const encodedParams: string = defaultAbiCoder.encode(
      [singleAssetTwoPartyCoinTransferInterpreterParamsEncoding],
      [{ limit: this.amount, tokenAddress: this.assetId }]
    )

    return {
      to: this.contractAddresses.ConditionalTransactionDelegateTarget,
      value: 0,
      data: iface.functions.executeWithdraw.encode([
        this.contractAddresses.WithdrawInterpreter,
        this.nonce,
        encodedOutcome,
        encodedParams,
      ]),
      operation: MultisigOperation.DelegateCall,
    };
  }
}
