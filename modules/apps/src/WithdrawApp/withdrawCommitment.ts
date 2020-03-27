import { MultisigTransaction, MultisigOperation } from "@connext/types";
import { MultisigCommitment } from "@connext/cf-core";
import { ERC20 } from "@connext/contracts";
import { BigNumberish, bigNumberify, Interface } from "ethers/utils";

export class WithdrawETHCommitment extends MultisigCommitment {
  public constructor(
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly to: string,
    public readonly value: BigNumberish,
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      to: this.to,
      value: bigNumberify(this.value),
      data: "0x",
      operation: MultisigOperation.Call,
    };
  }
}

export class WithdrawERC20Commitment extends MultisigCommitment {
  public constructor(
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly to: string,
    public readonly value: BigNumberish,
    public readonly tokenAddress: string,
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      data: new Interface(ERC20.abi).functions.transfer.encode([this.to, this.value]),
      operation: MultisigOperation.Call,
      to: this.tokenAddress,
      value: 0,
    };
  }
}
