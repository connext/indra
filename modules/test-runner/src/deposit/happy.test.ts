import { IConnextClient, BigNumberish, DepositAppState, EventNames } from "@connext/types";
import { delay, toBN } from "@connext/utils";
import { ERC20 } from "@connext/contracts";
import { BigNumber, Contract, constants } from "ethers";

import {
  createClient,
  ethProvider,
  expect,
  getOnchainBalance,
  getTestLoggers,
  NEGATIVE_ONE,
  ONE,
  TOKEN_AMOUNT,
  TOKEN_AMOUNT_SM,
  TWO,
  WRONG_ADDRESS,
} from "../util";

const { AddressZero, Zero, One } = constants;

const name = "Happy Deposits";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let client: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;
  let start: number;

  const assertClientFreeBalance = async (
    client: IConnextClient,
    expected: { node: BigNumberish; client: BigNumberish; assetId?: string },
  ): Promise<void> => {
    const freeBalance = await client.getFreeBalance(expected.assetId || AddressZero);
    expect(freeBalance[client.signerAddress]).to.equal(expected.client);
    // does not need to be equal, because node may be collateralizing
    expect(freeBalance[nodeSignerAddress]).to.be.at.least(expected.node);
  };

  const assertNodeFreeBalance = async (
    client: IConnextClient,
    expected: { node: BigNumberish; client: BigNumberish; assetId?: string },
  ): Promise<void> => {
    await assertClientFreeBalance(client, expected);
  };

  const assertOnchainBalance = async (
    client: IConnextClient,
    expected: { node: BigNumberish; client: BigNumberish; assetId?: string },
  ): Promise<void> => {
    const onchainBalance: BigNumber =
      expected.assetId === AddressZero
        ? await ethProvider.getBalance(client.multisigAddress)
        : await new Contract(expected.assetId!, ERC20.abi, ethProvider).balanceOf(
            client.multisigAddress,
          );
    expect(onchainBalance.eq(toBN(expected.node).add(toBN(expected.client))));
  };

  beforeEach(async () => {
    start = Date.now();
    client = await createClient();
    tokenAddress = client.config.contractAddresses[client.chainId].Token!;
    nodeSignerAddress = client.nodeSignerAddress;
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await client.off();
  });

  it("should deposit ETH", async () => {
    const expected = {
      node: Zero.toString(),
      client: ONE,
      assetId: AddressZero,
    };
    const response = await client.deposit({ amount: expected.client, assetId: expected.assetId });
    if (response.completed) {
      expect(response.transaction).to.be.ok;
      await response.completed();
    }
    await assertOnchainBalance(client, expected);
    await assertClientFreeBalance(client, expected);
    await assertNodeFreeBalance(client, expected);
    timeElapsed("beforeEach + test complete", start);
  });

  it("should deposit tokens (case-insensitive assetId)", async () => {
    const expected = {
      node: Zero.toString(),
      client: One.toString(),
      assetId: tokenAddress.toUpperCase(),
    };
    const response = await client.deposit({ amount: expected.client, assetId: expected.assetId });
    if (response.completed) {
      expect(response.transaction).to.be.ok;
      await response.completed();
    }
    await assertClientFreeBalance(client, expected);
    await assertNodeFreeBalance(client, expected);
  });

  it("should not be able to deposit with invalid token address", async () => {
    await expect(client.deposit({ amount: ONE, assetId: WRONG_ADDRESS })).to.be.rejectedWith(
      "invalid",
    );
  });

  it("should not be able to deposit with negative amount", async () => {
    await expect(client.deposit({ amount: NEGATIVE_ONE, assetId: AddressZero })).to.be.rejectedWith(
      "Value (-1) is not greater than 0",
    );
  });

  it("should not be able to propose deposit with value it doesn't have", async () => {
    await expect(
      client.deposit({
        amount: (await getOnchainBalance(client.signerAddress, tokenAddress)).add(1).toString(),
        assetId: client.config.contractAddresses[client.chainId].Token!,
      }),
    ).to.be.rejectedWith("is not less than or equal to");
  });

  it("client has already requested deposit rights before calling deposit", async () => {
    const expected = {
      node: Zero,
      client: ONE,
      assetId: tokenAddress,
    };
    await client.requestDepositRights({ assetId: expected.assetId });
    const response = await client.deposit({ amount: expected.client, assetId: expected.assetId });
    if (response.completed) {
      expect(response.transaction).to.be.ok;
      await response.completed();
    }
    await assertClientFreeBalance(client, expected);
    await assertNodeFreeBalance(client, expected);
    const { appIdentityHash } = await client.checkDepositRights({
      assetId: client.config.contractAddresses[client.chainId].Token!,
    });
    expect(appIdentityHash).to.be.undefined;
  });

  // TODO: move this test case to the node unit tests where the deposit app
  // flow of the node can be more granularly controlled
  it.skip("client tries to deposit while node already has deposit rights but has not sent a tx to chain", async () => {
    // send a payment to a receiver client to
    // trigger collateral event
    const expected = {
      node: Zero.toString(),
      client: TOKEN_AMOUNT.toString(),
      assetId: tokenAddress,
    };
    await client.deposit({ assetId: expected.assetId, amount: expected.client });
    await assertClientFreeBalance(client, expected);

    const receiver = await createClient();

    // TODO: chan_install events and nats subscription don't seem
    // to trigger promise resolution here...
    // cannot use INSTALL_EVENT because receiver will call install
    // for nodes proposed deposit app and install event will not be
    // emitted
    await new Promise(async (resolve, reject) => {
      receiver.on("PROPOSE_INSTALL_EVENT", (msg) => {
        if (
          msg.params.appDefinition ===
          receiver.config.contractAddresses[receiver.chainId].DepositApp
        ) {
          resolve();
        }
      });
      receiver.on("REJECT_INSTALL_EVENT", reject);
      await client.transfer({
        amount: TOKEN_AMOUNT_SM,
        assetId: expected.assetId,
        recipient: receiver.publicIdentifier,
      });
    });
    const getDepositApps = async () => {
      const apps = await receiver.getAppInstances();
      return apps.filter(
        (app) => app.appDefinition === client.config.contractAddresses[client.chainId].DepositApp,
      )[0];
    };
    while (!(await getDepositApps())) {
      await delay(200);
    }
    const depositApp = await getDepositApps();

    expect(depositApp).to.exist;
    const latestState = depositApp.latestState as DepositAppState;
    expect(latestState.transfers[0].to).to.be.eq(nodeSignerAddress);
    expect(latestState.transfers[1].to).to.be.eq(receiver.signerAddress);

    // try to deposit
    await expect(receiver.deposit({ amount: ONE, assetId: expected.assetId })).to.be.rejectedWith(
      "Node has unfinalized deposit",
    );
  });

  it.skip("client proposes deposit but never sends tx to chain", async () => {});

  it.skip("client proposes deposit, sends tx to chain, but deposit takes a long time to confirm", async () => {});

  it.skip("client proposes deposit, sends tx to chain, but deposit fails onchain", async () => {});

  it("client deposits eth, withdraws, then successfully deposits eth again", async () => {
    const expected = {
      node: Zero,
      client: ONE,
      assetId: AddressZero,
    };
    await new Promise(async (resolve, reject) => {
      client.once(EventNames.WITHDRAWAL_FAILED_EVENT, (msg) => reject(new Error(msg.error)));
      client.once(EventNames.DEPOSIT_FAILED_EVENT, (msg) => reject(new Error(msg.error)));
      client.once(EventNames.PROPOSE_INSTALL_FAILED_EVENT, (msg) => reject(new Error(msg.error)));
      client.once(EventNames.INSTALL_FAILED_EVENT, (msg) => reject(new Error(msg.error)));
      client.once(EventNames.UPDATE_STATE_FAILED_EVENT, (msg) => reject(new Error(msg.error)));
      client.once(EventNames.UNINSTALL_FAILED_EVENT, (msg) => reject(new Error(msg.error)));
      let response = await client.deposit({ amount: TWO, assetId: expected.assetId });
      if (response.completed) {
        expect(response.transaction).to.be.ok;
        await response.completed();
      }
      await client.withdraw({ amount: TWO, assetId: expected.assetId });
      response = await client.deposit({ amount: expected.client, assetId: expected.assetId });
      if (response.completed) {
        expect(response.transaction).to.be.ok;
        await response.completed();
      }
      resolve();
    });
    await assertClientFreeBalance(client, expected);
    await assertNodeFreeBalance(client, expected);
  });

  it("client deposits eth, withdraws, then successfully deposits tokens", async () => {
    const ethExpected = {
      client: Zero,
      assetId: AddressZero,
      node: Zero,
    };
    const tokenExpected = {
      client: ONE,
      assetId: tokenAddress,
      node: Zero,
    };
    let response = await client.deposit({ amount: TWO, assetId: ethExpected.assetId });
    if (response.completed) {
      expect(response.transaction).to.be.ok;
      await response.completed();
    }
    await client.withdraw({ amount: TWO, assetId: ethExpected.assetId });
    response = await client.deposit({
      amount: tokenExpected.client,
      assetId: tokenExpected.assetId,
    });
    if (response.completed) {
      expect(response.transaction).to.be.ok;
      await response.completed();
    }
    await assertClientFreeBalance(client, ethExpected);
    await assertClientFreeBalance(client, tokenExpected);
    await assertNodeFreeBalance(client, ethExpected);
    await assertNodeFreeBalance(client, tokenExpected);
  });
});
