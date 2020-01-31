import { xkeyKthAddress } from "../machine";
import { Zero } from "ethers/constants";
import { INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET } from "./errors";
import { StateChannel } from "../models";
import { BigNumber } from "ethers/utils";

// NOTE: will not fail if there is no free balance class. there is
// no free balance in the case of a channel between virtual
// participants
export function assertSufficientFundsWithinFreeBalance(
  channel: StateChannel,
  publicIdentifier: string,
  tokenAddress: string,
  depositAmount: BigNumber
): void {
  if (!channel.hasFreeBalance) return;

  const freeBalanceForToken =
    channel
      .getFreeBalanceClass()
      .getBalance(tokenAddress, xkeyKthAddress(publicIdentifier, 0)) || Zero;

  if (freeBalanceForToken.lt(depositAmount)) {
    throw Error(
      INSUFFICIENT_FUNDS_IN_FREE_BALANCE_FOR_ASSET(
        publicIdentifier,
        channel.multisigAddress,
        tokenAddress,
        freeBalanceForToken,
        depositAmount
      )
    );
  }
}
