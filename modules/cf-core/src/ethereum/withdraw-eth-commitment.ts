import { bigNumberify, BigNumberish } from "ethers/utils";

import { MultisigOperation, MultisigTransaction, DomainSeparator } from "../types";

import { MultisigCommitment } from "./multisig-commitment";

export class WithdrawETHCommitment extends MultisigCommitment {
  public constructor(
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly to: string,
    public readonly value: BigNumberish,
    public readonly domainSeparator: DomainSeparator,
    public readonly chainId: number,
    public readonly transactionCount: number
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      to: this.to,
      value: bigNumberify(this.value),
      data: "0x",
      operation: MultisigOperation.Call,
      domainName: this.domainSeparator.domainName,
      domainVersion: this.domainSeparator.domainVersion,
      chainId: this.chainId,
      domainSalt: this.domainSeparator.domainSalt,
      transactionCount: this.transactionCount
    };
  }
}
