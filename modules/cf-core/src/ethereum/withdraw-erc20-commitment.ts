import { BigNumberish, Interface } from "ethers/utils";

import { ERC20 } from "../contracts";

import { MultisigCommitment } from "./multisig-commitment";
import { MultisigOperation, MultisigTransaction } from "./types";

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
