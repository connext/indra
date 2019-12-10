import { Contract } from "ethers";
import { One, Two, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import log from "loglevel";

import {
  Node,
  NODE_EVENTS,
  DepositConfirmationMessage,
  DepositStartedMessage
} from "../../src";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../src/constants";
import { DolphinCoin, NetworkContextForTestSuite } from "../contracts";
import { INSUFFICIENT_ERC20_FUNDS_TO_DEPOSIT } from "../../src/methods/errors";
import { toBeEq } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  constructDepositRpc,
  createChannel,
  getFreeBalanceState,
  getTokenIndexedFreeBalanceStates,
  transferERC20Tokens,
  assertNodeMessage,
  deposit
} from "./utils";
import { Node as NodeTypes } from "@connext/types";

expect.extend({ toBeEq });

log.setLevel(log.levels.SILENT);

// NOTE: no deposit started event emitted for responder
function confirmDepositMessages(
  initiator: Node,
  responder: Node,
  params: NodeTypes.DepositParams
) {
  const startedMsg = {
    from: initiator.publicIdentifier,
    type: "DEPOSIT_STARTED_EVENT",
    data: {
      value: params.amount
    }
  };

  const confirmMsg = {
    from: initiator.publicIdentifier,
    type: "DEPOSIT_CONFIRMED_EVENT",
    data: params
  };

  initiator.once("DEPOSIT_STARTED_EVENT", (msg: DepositStartedMessage) => {
    assertNodeMessage(msg, startedMsg, ["data.txHash"]);
  });

  initiator.once(
    "DEPOSIT_CONFIRMED_EVENT",
    (msg: DepositConfirmationMessage) => {
      assertNodeMessage(msg, confirmMsg);
    }
  );

  responder.once(
    "DEPOSIT_CONFIRMED_EVENT",
    (msg: DepositConfirmationMessage) => {
      assertNodeMessage(msg, confirmMsg);
    }
  );
}

describe("Node method follows spec - deposit", () => {
  let nodeA: Node;
  let nodeB: Node;
  let provider: JsonRpcProvider;
  let multisigAddress: string;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    provider = new JsonRpcProvider(global["ganacheURL"]);

    multisigAddress = await createChannel(nodeA, nodeB);
    expect(multisigAddress).toBeDefined();
    nodeA.off("DEPOSIT_CONFIRMED_EVENT");
    nodeB.off("DEPOSIT_CONFIRMED_EVENT");
  });

  it("has the right balance before an ERC20 deposit has been made", async () => {
    const erc20ContractAddress = (global[
      "networkContext"
    ] as NetworkContextForTestSuite).DolphinCoin;

    const freeBalanceState = await getFreeBalanceState(
      nodeA,
      multisigAddress,
      erc20ContractAddress
    );

    expect(Object.values(freeBalanceState)).toMatchObject([Zero, Zero]);
  });

  it("has the right balance for both parties after deposits", async () => {
    const preDepositBalance = await provider.getBalance(multisigAddress);

    await deposit(nodeB, multisigAddress, One, nodeA);
    await deposit(nodeA, multisigAddress, One, nodeB);

    expect(await provider.getBalance(multisigAddress)).toBeEq(
      preDepositBalance.add(2)
    );

    const freeBalanceState = await getFreeBalanceState(nodeA, multisigAddress);

    expect(Object.values(freeBalanceState)).toMatchObject([One, One]);
  });

  it("updates balances correctly when depositing both ERC20 tokens and ETH", async () => {
    const erc20ContractAddress = (global[
      "networkContext"
    ] as NetworkContextForTestSuite).DolphinCoin;

    const erc20Contract = new Contract(
      erc20ContractAddress,
      DolphinCoin.abi,
      new JsonRpcProvider(global["ganacheURL"])
    );

    await transferERC20Tokens(await nodeA.signerAddress());
    await transferERC20Tokens(await nodeB.signerAddress());

    let preDepositBalance = await provider.getBalance(multisigAddress);
    const preDepositERC20Balance = await erc20Contract.functions.balanceOf(
      multisigAddress
    );

    await deposit(nodeA, multisigAddress, One, nodeB, erc20ContractAddress);
    await deposit(nodeB, multisigAddress, One, nodeA, erc20ContractAddress);

    expect(await provider.getBalance(multisigAddress)).toEqual(
      preDepositBalance
    );

    expect(await erc20Contract.functions.balanceOf(multisigAddress)).toEqual(
      preDepositERC20Balance.add(Two)
    );

    await confirmEthAndERC20FreeBalances(
      nodeA,
      multisigAddress,
      erc20ContractAddress
    );

    await confirmEthAndERC20FreeBalances(
      nodeB,
      multisigAddress,
      erc20ContractAddress
    );

    // now deposits ETH

    preDepositBalance = await provider.getBalance(multisigAddress);

    await deposit(nodeA, multisigAddress, One, nodeB);
    await deposit(nodeB, multisigAddress, One, nodeA);

    expect(await provider.getBalance(multisigAddress)).toBeEq(
      preDepositBalance.add(2)
    );

    const freeBalanceState = await getFreeBalanceState(nodeA, multisigAddress);

    expect(Object.values(freeBalanceState)).toMatchObject([One, One]);
  });
});

async function confirmEthAndERC20FreeBalances(
  node: Node,
  multisigAddress: string,
  erc20ContractAddress: string
) {
  const tokenIndexedFreeBalances = await getTokenIndexedFreeBalanceStates(
    node,
    multisigAddress
  );

  expect(
    Object.values(tokenIndexedFreeBalances[CONVENTION_FOR_ETH_TOKEN_ADDRESS])
  ).toMatchObject([Zero, Zero]);

  expect(
    Object.values(tokenIndexedFreeBalances[erc20ContractAddress])
  ).toMatchObject([One, One]);
}
