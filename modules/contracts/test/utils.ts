import { toBN, recoverAddressFromChannelMessage } from "@connext/utils";
import { waffle as buidler } from "@nomiclabs/buidler";
import * as chai from "chai";
import { solidity } from "ethereum-waffle";
import { use } from "chai";
import { BigNumber, BigNumberish, parseEther } from "ethers/utils";
import { Wallet } from "ethers";

export function mkXpub(prefix: string = "xpub"): string {
  return prefix.padEnd(111, "0");
}

export function mkAddress(prefix: string = "0x"): string {
  return prefix.padEnd(42, "0");
}

export function mkHash(prefix: string = "0x"): string {
  return prefix.padEnd(66, "0");
}

export function mkSig(prefix: string = "0x"): string {
  return prefix.padEnd(132, "0");
}

// ETH helpers
export const provider = buidler.provider;
export const mineBlock = async () => await provider.send("evm_mine", []);
export const snapshot = async () => await provider.send("evm_snapshot", []);
export const restore = async (snapshotId: any) => await provider.send("evm_revert", [snapshotId]);

// TODO: Not sure this works correctly/reliably...
export const moveToBlock = async (blockNumber: BigNumberish) => {
  const desired: BigNumber = toBN(blockNumber);
  const current: BigNumber = toBN(await provider.getBlockNumber());
  if (current.gt(desired)) {
    throw new Error(
      `Already at block ${current.toNumber()}, cannot rewind to ${blockNumber.toString()}`,
    );
  }
  if (current.eq(desired)) {
    return;
  }
  for (const _ of Array(desired.sub(current).toNumber())) {
    await mineBlock();
  }
  const final: BigNumber = toBN(await provider.getBlockNumber());
  expect(final).to.be.eq(desired);
};

use(require("chai-subset"));
use(solidity);
export const expect = chai.use(solidity).expect;

// funds recipient with a given amount of eth from other provider accounts
export const fund = async (amount: BigNumber, recipient: Wallet) => {
  for (const wallet of await provider.getWallets()) {
    if (wallet.address === recipient.address) {
      continue;
    }
    const current = await provider.getBalance(recipient.address);
    const diff = amount.sub(current);
    if (diff.lte(0)) {
      // account has max int, done
      return;
    }
    const funderBalance = await provider.getBalance(wallet.address);
    // leave 1 eth in account for gas or w.e
    const fundAmount = funderBalance.sub(parseEther("1"));
    if (fundAmount.lte(0)) {
      // funder has insufficient funds, move on
      continue;
    }
    // send transaction
    await wallet.sendTransaction({
      to: recipient.address,
      value: fundAmount.gt(diff) ? diff : fundAmount,
    });
  }
  const final = await provider.getBalance(recipient.address);
  if (final.lt(amount)) {
    throw new Error(
      `Insufficient funds after funding to max. Off by: ${final
        .sub(amount)
        .abs()
        .toString()}`,
    );
  }
};

export function sortByAddress(a: string, b: string) {
  return toBN(a).lt(toBN(b)) ? -1 : 1;
}

export function sortAddresses(addrs: string[]) {
  return addrs.sort(sortByAddress);
}

export async function sortSignaturesBySignerAddress(
  digest: string,
  signatures: string[],
): Promise<string[]> {
  return (
    await Promise.all(
      signatures.map(async sig => ({ sig, addr: await recoverAddressFromChannelMessage(digest, sig) })),
    )
  )
    .sort((a, b) => sortByAddress(a.addr, b.addr))
    .map(x => x.sig);
}
