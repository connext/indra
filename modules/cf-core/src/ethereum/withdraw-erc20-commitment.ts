import { BigNumberish, Interface } from "ethers/utils";

import { ERC20 } from "../contracts";
import {
  MultisigOperation,
  MultisigTransaction,
  DomainSeparator
} from "../types";

import { MultisigCommitment } from "./multisig-commitment";

export class WithdrawERC20Commitment extends MultisigCommitment {
  public constructor(
    public readonly multisigAddress: string,
    public readonly multisigOwners: string[],
    public readonly to: string,
    public readonly value: BigNumberish,
    public readonly tokenAddress: string,
    public readonly domainSeparator: DomainSeparator,
    public readonly chainId: number,
    public readonly transactionCount: number
  ) {
    super(multisigAddress, multisigOwners);
  }

  public getTransactionDetails(): MultisigTransaction {
    return {
      data: new Interface(ERC20.abi).functions.transfer.encode([
        this.to,
        this.value
      ]),
      operation: MultisigOperation.Call,
      to: this.tokenAddress,
      value: 0,
      domainName: this.domainSeparator.domainName,
      domainVersion: this.domainSeparator.domainVersion,
      chainId: this.chainId,
      domainSalt: this.domainSeparator.domainSalt,
      transactionCount: this.transactionCount
    };
  }
}
