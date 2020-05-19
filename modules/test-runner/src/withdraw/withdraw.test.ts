import { MinimumViableMultisig } from "@connext/contracts";
import { IConnextClient, EventNames, BigNumberish } from "@connext/types";
import { Wallet, Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";

import {
  createClient,
  expect,
  fundChannel,
  NEGATIVE_ZERO_ZERO_ONE_ETH,
  requestDepositRights,
  withdrawFromChannel,
  ZERO_ZERO_ONE_ETH,
  ZERO_ZERO_TWO_ETH,
  ZERO_ZERO_ZERO_ONE_ETH,
} from "../util";

// TODO: multiple withdrawal tests are skipped because there are issues where
// the TX is sent before the client can subscribe. need to fix by possibly increasing block
// time
describe.only("Withdrawal", () => {
  let client: IConnextClient;
  let tokenAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
  });

  it("happy case: client successfully withdraws eth and node submits the tx", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    // withdraw
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);
  });

  it.skip("happy case: client successfully withdraws same amount of eth twice", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    const recipient = Wallet.createRandom().address;
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero, recipient);
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero, recipient);
  });

  it("happy case: client successfully withdraws tokens and node submits the tx", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress);
    // withdraw
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);
  });

  it("client tries to withdraw more than it has in free balance", async () => {
    await fundChannel(client, ZERO_ZERO_ZERO_ONE_ETH);
    await expect(withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero)).to.be.rejectedWith(
      `Insufficient funds.`,
    );
  });

  it("client tries to withdraw a negative amount", async () => {
    await fundChannel(client, ZERO_ZERO_ONE_ETH);
    await expect(
      withdrawFromChannel(client, NEGATIVE_ZERO_ZERO_ONE_ETH, AddressZero),
    ).to.be.rejectedWith(`invalid number value`);
  });

  it("client tries to withdraw to an invalid recipient address", async () => {
    await fundChannel(client, ZERO_ZERO_ONE_ETH);
    const recipient = "0xabc";
    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero, recipient),
    ).to.be.rejectedWith(`invalid address`);
  });

  it("client tries to withdraw with invalid assetId", async () => {
    await fundChannel(client, ZERO_ZERO_ONE_ETH);
    // cannot use util fn because it will check the pre withdraw free balance,
    // which will throw a separate error
    const assetId = "0xabc";
    await expect(
      client.withdraw({
        amount: ZERO_ZERO_ONE_ETH.toString(),
        assetId,
        recipient: Wallet.createRandom().address,
      }),
    ).to.be.rejectedWith(`invalid address`);
  });

  // TODO: fix race condition
  it.skip("client successfully withdraws tokens and eth concurrently", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress);
    // withdraw (dont await first for concurrency). Note: don't withdraw
    // same assetId twice bc utils compare only initial / final balances
    await Promise.all([
      withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero),
      withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress),
    ]);
  });

  // FIXME: may have race condition! saw intermittent failures, tough to
  // consistently reproduce. appear as `validating signer` errors.
  // see issue #705
  it.skip("client tries to withdraw while node is collateralizing", async (done: any) => {
    await fundChannel(client, ZERO_ZERO_ONE_ETH);

    let eventsCaught = 0;
    client.once("DEPOSIT_CONFIRMED_EVENT", async () => {
      // make sure node free balance increases
      const freeBalance = await client.getFreeBalance(AddressZero);
      expect(freeBalance[client.nodeSignerAddress]).to.be.above(Zero);
      eventsCaught += 1;
      if (eventsCaught === 2) {
        done();
      }
    });

    // no withdraw confirmed event thrown here...
    client.once(EventNames.WITHDRAWAL_CONFIRMED_EVENT, () => {
      eventsCaught += 1;
      if (eventsCaught === 2) {
        done();
      }
    });

    // simultaneously request collateral and withdraw
    client.requestCollateral(AddressZero);
    // use user-submitted to make sure that the event is properly
    // thrown
    withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);
    // TODO: events for withdrawal commitments! issue 698
  });

  describe("client tries to withdraw while it has active deposit rights", () => {
    it("client has active rights in eth, withdrawing eth", async () => {
      await fundChannel(client, ZERO_ZERO_ONE_ETH);
      // give client eth rights
      await requestDepositRights(client);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, AddressZero);
    });

    it("client has active rights in tokens, withdrawing eth", async () => {
      await fundChannel(client, ZERO_ZERO_ONE_ETH);
      // give client eth rights
      await requestDepositRights(client, tokenAddress);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, AddressZero);
    });

    it("client has active rights in tokens, withdrawing tokens", async () => {
      await fundChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);
      // give client eth rights
      await requestDepositRights(client, tokenAddress);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, tokenAddress);
    });

    it("client has active rights in eth, withdrawing tokens", async () => {
      await fundChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);
      // give client eth rights
      await requestDepositRights(client, AddressZero);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, tokenAddress);
    });
  });

  describe("totalWithdrawnAmount onchain increases when withdraw happens", () => {
    let multisigContract: Contract;

    beforeEach(async() => {
      await client.deployMultisig();
      multisigContract = new Contract(
        client.multisigAddress,
        MinimumViableMultisig.abi as any,
        client.ethProvider,
      );
    });

    it("successfully updates eth after first withdraw", async () => {
      const totalAmountWithdrawnBefore: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(AddressZero);

      await fundChannel(client, ZERO_ZERO_TWO_ETH);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);

      const totalAmountWithdrawnAfter: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(AddressZero);
      expect(totalAmountWithdrawnAfter).to.be.eq(ZERO_ZERO_ONE_ETH.add(totalAmountWithdrawnBefore));
    });

    it("successfully updates token after first withdraw", async () => {
      const totalAmountWithdrawnBefore: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(tokenAddress);

      await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);

      const totalAmountWithdrawnAfter: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(tokenAddress);
      expect(totalAmountWithdrawnAfter).to.be.eq(ZERO_ZERO_ONE_ETH.add(totalAmountWithdrawnBefore));
    });

    it.skip("successfully updates eth and token multiple times", async () => {
      const totalAmountWithdrawnBeforeEth: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(AddressZero);
      const totalAmountWithdrawnBeforeToken: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(tokenAddress);

      await fundChannel(client, ZERO_ZERO_TWO_ETH);
      await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);

      const totalAmountWithdrawnAfterEth: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(AddressZero);
      expect(totalAmountWithdrawnAfterEth).to.be.eq(
        ZERO_ZERO_TWO_ETH.add(totalAmountWithdrawnBeforeEth),
      );
      const totalAmountWithdrawnAfterToken: BigNumberish =
        await multisigContract.functions.totalAmountWithdrawn(tokenAddress);
      expect(totalAmountWithdrawnAfterToken).to.be.eq(
        ZERO_ZERO_ONE_ETH.add(totalAmountWithdrawnBeforeToken),
      );
    });
  });
});
