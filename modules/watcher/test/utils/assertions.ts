import { waffleChai } from "@ethereum-waffle/chai";
import { use } from "chai";
import { Contract, Wallet } from "ethers";
import { MinimumViableMultisig } from "@connext/contracts";
import { CONVENTION_FOR_ETH_ASSET_ID } from "@connext/types";
import { expect } from "chai";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

/////////////////////////////
//// Assertions

use(require("chai-as-promised"));
use(require("chai-subset"));
use(waffleChai);

export { expect } from "chai";

/////////////////////////////
//// Assertion Fns
export const verifyOnchainBalancesPostChallenge = async (
  multisigAddress: string,
  freeBalanceParticipants: string[],
  expected: { [assetId: string]: BigNumber },
  wallet: Wallet,
) => {
  const withdrawn = await new Contract(
    multisigAddress,
    MinimumViableMultisig.abi,
    wallet,
  ).functions.totalAmountWithdrawn(CONVENTION_FOR_ETH_ASSET_ID);
  expect(withdrawn).to.be.eq(expected[CONVENTION_FOR_ETH_ASSET_ID]);
  expect(await wallet.provider.getBalance(multisigAddress)).to.be.eq(Zero);
  expect((await wallet.provider.getBalance(freeBalanceParticipants[0])).toString()).to.be.eq(
    expected[CONVENTION_FOR_ETH_ASSET_ID],
  );
  expect((await wallet.provider.getBalance(freeBalanceParticipants[1])).toString()).to.be.eq(Zero);
};
