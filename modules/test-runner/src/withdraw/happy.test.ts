import { MinimumViableMultisig } from "@connext/contracts";
import { IConnextClient, BigNumberish, CONVENTION_FOR_ETH_ASSET_ID } from "@connext/types";
import { Wallet, Contract, constants } from "ethers";

import {
  createClient,
  expect,
  fundChannel,
  getTestLoggers,
  NEGATIVE_ZERO_ZERO_ONE_ETH,
  requestCollateral,
  requestDepositRights,
  withdrawFromChannel,
  ZERO_ZERO_ONE_ETH,
  ZERO_ZERO_TWO_ETH,
  ZERO_ZERO_ZERO_ONE_ETH,
} from "../util";

const { AddressZero } = constants;

const name = "Happy Withdrawals";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let client: IConnextClient;
  let start: number;
  let tokenAddress: string;

  beforeEach(async () => {
    start = Date.now();
    client = await createClient({ id: "A" });
    tokenAddress = client.config.contractAddresses[client.chainId].Token!;
    timeElapsed("beforeEach finished", start);
  });

  it("should withdraw eth and node should submit the tx", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);
  });

  it("should withdraw tokens & node should submit the tx (case-insensitive assetId)", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress.toUpperCase());
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress.toUpperCase());
  });

  it("should fail to withdraw eth if the recipient address has an invalid checksum", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    const recipient = Wallet.createRandom().address.toUpperCase();
    expect(withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero, recipient)).to.be.rejected;
  });

  // Currently fails because of this: https://github.com/connext/indra/issues/1186
  it.skip("client successfully withdraws same amount of eth twice", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    const recipient = Wallet.createRandom().address;
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero, recipient);
    await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero, recipient);
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
    ).to.be.rejectedWith(`value out-of-bounds`);
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
  it("client successfully withdraws tokens and eth concurrently", async () => {
    await fundChannel(client, ZERO_ZERO_TWO_ETH);
    await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress);
    // withdraw (dont await first for concurrency). Note: don't withdraw
    // same assetId twice bc utils compare only initial / final balances
    await Promise.all([
      withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero),
      withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress),
    ]);
  });

  it("client tries to withdraw while node is collateralizing", async () => {
    await fundChannel(client, ZERO_ZERO_ONE_ETH);

    await Promise.all([
      requestCollateral(client, AddressZero, true),
      withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero),
    ]);
  });

  describe("client tries to withdraw while it has active deposit rights", () => {
    beforeEach(async () => {
      await fundChannel(client, ZERO_ZERO_ONE_ETH);
      await fundChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);
      // if node is collateralizing, it will not allow client to gain deposit
      // rights, so make sure that the channel is collateralized properly
      await requestCollateral(client, tokenAddress);
      await requestCollateral(client, CONVENTION_FOR_ETH_ASSET_ID);
    });

    it("client has active rights in eth, withdrawing eth", async () => {
      // give client eth rights
      await requestDepositRights(client);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, AddressZero);
    });

    it("client has active rights in tokens, withdrawing eth", async () => {
      // give client eth rights
      await requestDepositRights(client, tokenAddress);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, AddressZero);
    });

    it("client has active rights in tokens, withdrawing tokens", async () => {
      // give client eth rights
      await requestDepositRights(client, tokenAddress);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, tokenAddress);
    });

    it("client has active rights in eth, withdrawing tokens", async () => {
      // give client eth rights
      await requestDepositRights(client, AddressZero);
      // try to withdraw
      await withdrawFromChannel(client, ZERO_ZERO_ZERO_ONE_ETH, tokenAddress);
    });
  });

  describe("totalWithdrawnAmount onchain increases when withdraw happens", () => {
    let multisigContract: Contract;

    beforeEach(async () => {
      await client.deployMultisig();
      multisigContract = new Contract(
        client.multisigAddress,
        MinimumViableMultisig.abi,
        client.ethProvider,
      );
    });

    it("successfully updates eth after first withdraw", async () => {
      const totalAmountWithdrawnBefore: BigNumberish = await multisigContract.totalAmountWithdrawn(
        AddressZero,
      );

      await fundChannel(client, ZERO_ZERO_TWO_ETH);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);

      const totalAmountWithdrawnAfter: BigNumberish = await multisigContract.totalAmountWithdrawn(
        AddressZero,
      );
      expect(totalAmountWithdrawnAfter).to.be.eq(ZERO_ZERO_ONE_ETH.add(totalAmountWithdrawnBefore));
    });

    it("successfully updates token after first withdraw", async () => {
      const totalAmountWithdrawnBefore: BigNumberish = await multisigContract.totalAmountWithdrawn(
        tokenAddress,
      );

      await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);

      const totalAmountWithdrawnAfter = await multisigContract.totalAmountWithdrawn(
        tokenAddress,
      );
      expect(totalAmountWithdrawnAfter).to.be.eq(ZERO_ZERO_ONE_ETH.add(totalAmountWithdrawnBefore));
    });

    it.skip("successfully updates eth and token multiple times", async () => {
      const totalAmountWithdrawnBeforeEth = await multisigContract.totalAmountWithdrawn(
        AddressZero,
      );
      const totalAmountWithdrawnBeforeToken = await multisigContract.totalAmountWithdrawn(
        tokenAddress,
      );

      await fundChannel(client, ZERO_ZERO_TWO_ETH);
      await fundChannel(client, ZERO_ZERO_TWO_ETH, tokenAddress);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, AddressZero);
      await withdrawFromChannel(client, ZERO_ZERO_ONE_ETH, tokenAddress);

      const totalAmountWithdrawnAfterEth = await multisigContract.totalAmountWithdrawn(
        AddressZero,
      );
      expect(totalAmountWithdrawnAfterEth).to.be.eq(
        ZERO_ZERO_TWO_ETH.add(totalAmountWithdrawnBeforeEth),
      );
      const totalAmountWithdrawnAfterToken = await multisigContract.totalAmountWithdrawn(
        tokenAddress,
      );
      expect(totalAmountWithdrawnAfterToken).to.be.eq(
        ZERO_ZERO_ONE_ETH.add(totalAmountWithdrawnBeforeToken),
      );
    });
  });
});
