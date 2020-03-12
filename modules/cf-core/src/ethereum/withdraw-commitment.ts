import { Address } from "@connext/types";
import { bigNumberify, BigNumberish, Interface } from "ethers/utils";

import { ERC20 } from "../contracts";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../constants";
import { StateChannel } from "../models";
import { MultisigOperation, MultisigTransaction } from "../types";

import { MultisigCommitment } from "./multisig-commitment";

export const getWithdrawCommitment = (
  stateChannel: StateChannel,
  amount: BigNumberish,
  asset: Address,
  recipient: Address,
) => {
  if (asset === CONVENTION_FOR_ETH_TOKEN_ADDRESS) {
    return new WithdrawETHCommitment(
      stateChannel.multisigAddress,
      stateChannel.multisigOwners,
      recipient,
      amount,
    );
  }
  return new WithdrawERC20Commitment(
    stateChannel.multisigAddress,
    stateChannel.multisigOwners,
    recipient,
    amount,
    asset,
  );
};

export type WithdrawCommitment = WithdrawETHCommitment | WithdrawERC20Commitment;

class WithdrawETHCommitment extends MultisigCommitment {
  public constructor(
    public readonly multisigAddress: Address,
    public readonly multisigOwners: Address[],
    public readonly to: Address,
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

class WithdrawERC20Commitment extends MultisigCommitment {
  public constructor(
    public readonly multisigAddress: Address,
    public readonly multisigOwners: Address[],
    public readonly to: Address,
    public readonly value: BigNumberish,
    public readonly tokenAddress: Address,
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
