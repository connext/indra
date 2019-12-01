import DolphinCoin from "@counterfactual/cf-funding-protocol-contracts/expected-build-artifacts/DolphinCoin.json";
import { NetworkContextForTestSuite } from "@counterfactual/local-ganache-server";
import { randomBytes } from "crypto";
import { Contract, Wallet } from "ethers";
import { One, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { getAddress, hexlify } from "ethers/utils";

import { Node, NODE_EVENTS, WithdrawStartedMessage } from "../../src";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../src/constants";
import { toBeEq, toBeLt } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  constructWithdrawCommitmentRpc,
  constructWithdrawRpc,
  createChannel,
  deployStateDepositHolder,
  deposit,
  getFreeBalanceState,
  transferERC20Tokens,
  assertNodeMessage
} from "./utils";
import { WithdrawConfirmationMessage } from "../../src/types";
import { Node as NodeTypes } from "@connext/types";

expect.extend({ toBeEq, toBeLt });

// NOTE: responder does not have confirm event for any withdrawals
function confirmWithdrawalMessages(
  initiator: Node,
  responder: Node,
  params: NodeTypes.WithdrawParams
) {
  // initiator messages
  initiator.once(
    NODE_EVENTS.WITHDRAWAL_CONFIRMED,
    (msg: WithdrawConfirmationMessage) => {
      assertNodeMessage(
        msg,
        {
          from: initiator.publicIdentifier,
          type: NODE_EVENTS.WITHDRAWAL_CONFIRMED,
          data: {
            txReceipt: {
              from: initiator.freeBalanceAddress,
              to: params.multisigAddress
            }
          }
        },
        [
          "data.txReceipt.blockHash",
          "data.txReceipt.blockNumber",
          "data.txReceipt.byzantium",
          "data.txReceipt.confirmations",
          "data.txReceipt.contractAddress",
          "data.txReceipt.cumulativeGasUsed",
          "data.txReceipt.gasUsed",
          "data.txReceipt.logs",
          "data.txReceipt.logsBloom",
          "data.txReceipt.status",
          "data.txReceipt.transactionHash",
          "data.txReceipt.transactionIndex"
        ]
      );
    }
  );

  const startedMsg = {
    from: initiator.publicIdentifier,
    type: NODE_EVENTS.WITHDRAWAL_STARTED,
    data: { params }
  };
  initiator.once(NODE_EVENTS.WITHDRAWAL_STARTED, (msg: any) => {
    assertNodeMessage(msg, startedMsg, ["data.txHash"]);
  });

  responder.once(
    NODE_EVENTS.WITHDRAWAL_STARTED,
    (msg: WithdrawStartedMessage) => {
      assertNodeMessage(msg, startedMsg);
    }
  );
}

describe("Node method follows spec - withdraw", () => {
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

    const txHash = await deployStateDepositHolder(nodeA, multisigAddress);
    expect(txHash).toBeDefined();

    nodeB.on(NODE_EVENTS.DEPOSIT_CONFIRMED, () => {});
  });

  it("has the right balance for both parties after withdrawal", async () => {
    const startingMultisigBalance = await provider.getBalance(multisigAddress);

    await deposit(nodeA, multisigAddress, One);

    const postDepositMultisigBalance = await provider.getBalance(
      multisigAddress
    );

    expect(postDepositMultisigBalance).toBeEq(startingMultisigBalance.add(One));

    const recipient = getAddress(hexlify(randomBytes(20)));

    expect(await provider.getBalance(recipient)).toBeEq(Zero);

    const withdrawReq = constructWithdrawRpc(
      multisigAddress,
      One,
      CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      recipient
    );

    confirmWithdrawalMessages(
      nodeA,
      nodeB,
      withdrawReq.parameters as NodeTypes.WithdrawParams
    );

    const {
      result: {
        result: { txHash }
      }
    } = await nodeA.rpcRouter.dispatch(withdrawReq);

    expect(txHash).toBeDefined();
    expect(txHash.length).toBe(66);
    expect(txHash.substr(0, 2)).toBe("0x");

    expect(await provider.getBalance(multisigAddress)).toBeEq(
      startingMultisigBalance
    );

    expect(await provider.getBalance(recipient)).toBeEq(One);
  });

  it("has the right balance for both parties after withdrawal of ERC20 tokens", async () => {
    const erc20ContractAddress = (global[
      "networkContext"
    ] as NetworkContextForTestSuite).DolphinCoin;

    const erc20Contract = new Contract(
      erc20ContractAddress,
      DolphinCoin.abi,
      new JsonRpcProvider(global["ganacheURL"])
    );

    expect(multisigAddress).toBeDefined();

    await transferERC20Tokens(await nodeA.signerAddress());

    const startingMultisigTokenBalance = await erc20Contract.functions.balanceOf(
      multisigAddress
    );

    await deposit(nodeA, multisigAddress, One, erc20ContractAddress);

    const postDepositMultisigTokenBalance = await erc20Contract.functions.balanceOf(
      multisigAddress
    );

    expect(postDepositMultisigTokenBalance).toBeEq(
      startingMultisigTokenBalance.add(One)
    );

    const recipient = getAddress(hexlify(randomBytes(20)));

    expect(await erc20Contract.functions.balanceOf(recipient)).toBeEq(Zero);

    const withdrawReq = constructWithdrawRpc(
      multisigAddress,
      One,
      erc20ContractAddress,
      recipient
    );

    confirmWithdrawalMessages(
      nodeA,
      nodeB,
      withdrawReq.parameters as NodeTypes.WithdrawParams
    );

    await nodeA.rpcRouter.dispatch(withdrawReq);

    expect(await erc20Contract.functions.balanceOf(multisigAddress)).toBeEq(
      startingMultisigTokenBalance
    );

    expect(await erc20Contract.functions.balanceOf(recipient)).toBeEq(One);
  });

  it("Node A produces a withdraw commitment and non-Node A submits the commitment to the network", async () => {
    const startingMultisigBalance = await provider.getBalance(multisigAddress);

    await deposit(nodeA, multisigAddress, One);

    const postDepositMultisigBalance = await provider.getBalance(
      multisigAddress
    );

    const getFreeBalance = async (node: Node) => {
      return getFreeBalanceState(
        node,
        multisigAddress,
        CONVENTION_FOR_ETH_TOKEN_ADDRESS
      );
    };

    expect(await getFreeBalance(nodeA)).toEqual(await getFreeBalance(nodeB));

    expect(postDepositMultisigBalance).toBeEq(startingMultisigBalance.add(One));

    const recipient = getAddress(hexlify(randomBytes(20)));

    expect(await provider.getBalance(recipient)).toBeEq(Zero);

    const withdrawCommitmentReq = constructWithdrawCommitmentRpc(
      multisigAddress,
      One,
      CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      recipient
    );

    // NOTE: no initiator withdrawal started event
    // and no confirm events
    confirmWithdrawalMessages(
      nodeA,
      nodeB,
      withdrawCommitmentReq.parameters as NodeTypes.WithdrawParams
    );

    const {
      result: {
        result: { transaction }
      }
    } = await nodeA.rpcRouter.dispatch(withdrawCommitmentReq);

    expect(transaction).toBeDefined();

    const externalFundedAccount = new Wallet(
      global["fundedPrivateKey"],
      provider
    );

    const externalAccountPreTxBalance = await provider.getBalance(
      externalFundedAccount.address
    );
    const nodeAPreTxBalance = await provider.getBalance(nodeA.signerAddress());

    expect(await getFreeBalance(nodeA)).toEqual(await getFreeBalance(nodeB));

    await externalFundedAccount.sendTransaction(transaction);

    const externalAccountPostTxBalance = await provider.getBalance(
      externalFundedAccount.address
    );
    const nodeAPostTxBalance = await provider.getBalance(nodeA.signerAddress());

    expect(externalAccountPostTxBalance).toBeLt(externalAccountPreTxBalance);
    expect(nodeAPreTxBalance).toBeEq(nodeAPostTxBalance);

    expect(await provider.getBalance(multisigAddress)).toBeEq(
      startingMultisigBalance
    );

    expect(await provider.getBalance(recipient)).toBeEq(One);
  });
});
