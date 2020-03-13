import { MinimalTransaction } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { bigNumberify, getAddress, hexlify, randomBytes } from "ethers/utils";

import { StateChannel } from "../models";
import { getWithdrawCommitment, WithdrawCommitment } from "./withdraw-commitment";

/**
 * This test suite decodes a constructed WithdrawCommitment transaction object
 * to the specifications defined here:
 * https://specs.counterfactual.com/11-withdraw-protocol
 */
describe("Withdraw Commitment", () => {
  let commitment: WithdrawCommitment;
  let tx: MinimalTransaction;

  const multisigAddress = getAddress(hexlify(randomBytes(20)));
  const multisigOwners = [
    getAddress(hexlify(randomBytes(20))),
    getAddress(hexlify(randomBytes(20))),
  ];
  const to = getAddress(hexlify(randomBytes(20)));
  const value = bigNumberify(Math.round(10000 * Math.random()));

  beforeAll(() => {
    commitment = getWithdrawCommitment(
      { multisigAddress, multisigOwners } as StateChannel,
      value,
      AddressZero,
      to,
    );
    tx = commitment.getTransactionDetails();
  });

  it("should be to the receiver", () => {
    expect(tx.to).toBe(to);
  });

  it("should have the value being sent", () => {
    expect(tx.value).toEqual(value);
  });
});

