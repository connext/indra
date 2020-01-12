import { utils } from "@connext/client";
import { IConnextClient } from "@connext/types";
import { Wallet } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { parseEther } from "ethers/utils";

import {
  createClient,
  fundChannel,
  NEGATIVE_ZERO__ZERO_ONE,
  requestDepositRights,
  withdrawFromChannel,
  ZERO_ZERO_ONE,
  ZERO_ZERO_TWO,
  ZERO_ZERO_ZERO_ONE,
} from "../util";

const { xpubToAddress } = utils;

describe("Withdrawal", () => {
  let client: IConnextClient;
  let tokenAddress: string;

  beforeEach(async () => {
    client = await createClient();
    tokenAddress = client.config.contractAddresses.Token;
  }, 90_000);

  test("happy case: client successfully withdraws eth and submits the tx itself", async () => {
    // fund client with eth
    await fundChannel(client, ZERO_ZERO_TWO);
    // withdraw
    await withdrawFromChannel(client, ZERO_ZERO_ONE, AddressZero, true);
  });

  test("happy case: client successfully withdraws tokens and submits the tx itself", async () => {
    // fund client with tokens
    await fundChannel(client, ZERO_ZERO_TWO, tokenAddress);
    // withdraw
    await withdrawFromChannel(client, ZERO_ZERO_ONE, tokenAddress, true);
  });

  test("happy case: client successfully withdraws eth and node submits the tx", async () => {
    await fundChannel(client, ZERO_ZERO_TWO);
    // withdraw
    await withdrawFromChannel(client, ZERO_ZERO_ONE, AddressZero);
  });

  test("happy case: client successfully withdraws tokens and node submits the tx", async () => {
    await fundChannel(client, ZERO_ZERO_TWO, tokenAddress);
    // withdraw
    await withdrawFromChannel(client, ZERO_ZERO_ONE, tokenAddress);
  });

  test("client tries to withdraw more than it has in free balance", async () => {
    await fundChannel(client, ZERO_ZERO_ZERO_ONE);
    await expect(withdrawFromChannel(client, ZERO_ZERO_ONE, AddressZero)).rejects.toThrow(
      `Value (${parseEther(ZERO_ZERO_ONE)}) is not less than or equal to ${parseEther(
        ZERO_ZERO_ZERO_ONE,
      )}`,
    );
  });

  test("client tries to withdraw a negative amount", async () => {
    await fundChannel(client, ZERO_ZERO_ONE);
    await expect(withdrawFromChannel(client, NEGATIVE_ZERO__ZERO_ONE, AddressZero)).rejects.toThrow(
      `Value (${parseEther(NEGATIVE_ZERO__ZERO_ONE)}) is not greater than or equal to 0`,
    );
  });

  test("client tries to withdraw to an invalid recipient address", async () => {
    await fundChannel(client, ZERO_ZERO_ONE);
    await expect(
      withdrawFromChannel(client, ZERO_ZERO_ONE, AddressZero, false, "0xabc"),
    ).rejects.toThrow(`Value \"0xabc\" is not a valid eth address`);
  });

  test("client tries to withdraw with invalid assetId", async () => {
    await fundChannel(client, ZERO_ZERO_ONE);
    // cannot use util fn because it will check the pre withdraw free balance,
    // which will throw a separate error
    await expect(
      client.withdraw({
        amount: parseEther(ZERO_ZERO_ONE).toString(),
        assetId: "0xabc",
        recipient: Wallet.createRandom().address,
      }),
    ).rejects.toThrow(`Value \"0xabc\" is not a valid eth address`);
  });

  // FIXME: may have race condition! saw intermittent failures, tough to
  // consistently reproduce. appear as `validating signer` errors.
  // see issue #705
  test.skip("client tries to withdraw while node is collateralizing", async (done: any) => {
    await fundChannel(client, ZERO_ZERO_ONE);

    let eventsCaught = 0;
    client.once("DEPOSIT_CONFIRMED_EVENT", async () => {
      // make sure node free balance increases
      const freeBalance = await client.getFreeBalance(AddressZero);
      expect(freeBalance[xpubToAddress(client.nodePublicIdentifier)].gt(Zero)).toBeTruthy();
      eventsCaught += 1;
      if (eventsCaught === 2) {
        done();
      }
    });

    // no withdraw confirmed event thrown here...
    client.once("WITHDRAWAL_CONFIRMED_EVENT", () => {
      eventsCaught += 1;
      if (eventsCaught === 2) {
        done();
      }
    });

    // simultaneously request collateral and withdraw
    client.requestCollateral(AddressZero);
    // use user-submitted to make sure that the event is properly
    // thrown
    withdrawFromChannel(client, ZERO_ZERO_ONE, AddressZero, true);
    // TODO: events for withdrawal commitments! issue 698
  });

  describe("client tries to withdraw while it has active deposit rights", () => {
    test("client has active rights in eth, withdrawing eth", async () => {
      await fundChannel(client, ZERO_ZERO_ONE);
      // give client eth rights
      await requestDepositRights(client);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, AddressZero);
    });

    test("client has active rights in tokens, withdrawing eth", async () => {
      await fundChannel(client, ZERO_ZERO_ONE);
      // give client eth rights
      await requestDepositRights(client, tokenAddress);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, AddressZero);
    });

    test("client has active rights in tokens, withdrawing tokens", async () => {
      await fundChannel(client, ZERO_ZERO_ONE, tokenAddress);
      // give client eth rights
      await requestDepositRights(client, tokenAddress);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, tokenAddress);
    });

    test("client has active rights in eth, withdrawing tokens", async () => {
      await fundChannel(client, ZERO_ZERO_ONE, tokenAddress);
      // give client eth rights
      await requestDepositRights(client, AddressZero);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, tokenAddress);
    });
  });

  describe("client tries to withdraw while node has active deposit rights", () => {
    test("node has active rights in eth, withdrawing eth", async () => {
      await fundChannel(client, ZERO_ZERO_ONE);
      // give client eth rights
      await requestDepositRights(client, AddressZero, false);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, AddressZero);
    });

    test("node has active rights in tokens, withdrawing eth", async () => {
      await fundChannel(client, ZERO_ZERO_ONE);
      // give client eth rights
      await requestDepositRights(client, tokenAddress, false);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, AddressZero);
    });

    test("node has active rights in tokens, withdrawing tokens", async () => {
      await fundChannel(client, ZERO_ZERO_ONE, tokenAddress);
      // give client eth rights
      await requestDepositRights(client, tokenAddress, false);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, tokenAddress);
    });

    test("node has active rights in eth, withdrawing tokens", async () => {
      await fundChannel(client, ZERO_ZERO_ONE, tokenAddress);
      // give client eth rights
      await requestDepositRights(client, AddressZero, false);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE, tokenAddress);
    });
  });
});
