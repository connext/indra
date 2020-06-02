import { DolphinCoin } from "@connext/contracts";
import { MethodParams, EventNames } from "@connext/types";
import { getAddressFromAssetId, deBigNumberifyJson } from "@connext/utils";
import { BigNumber, Contract, providers, constants } from "ethers";

import { CFCore } from "../../cfCore";

import { TestContractAddresses } from "../contracts";
import { toBeEq } from "../bignumber-jest-matcher";

import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  createChannel,
  deposit,
  getFreeBalanceState,
  getTokenIndexedFreeBalanceStates,
  transferERC20Tokens,
} from "../utils";

const { One, Two, Zero, AddressZero } = constants;

expect.extend({ toBeEq });

// NOTE: no deposit started event emitted for responder
export function confirmDepositMessages(
  initiator: CFCore,
  responder: CFCore,
  params: MethodParams.Deposit,
) {
  const startedMsg = {
    from: initiator.publicIdentifier,
    type: "DEPOSIT_STARTED_EVENT",
    data: {
      value: params.amount,
    },
  };

  const confirmMsg = {
    from: initiator.publicIdentifier,
    type: "DEPOSIT_CONFIRMED_EVENT",
    data: params,
  };

  initiator.once("DEPOSIT_STARTED_EVENT", (msg) => {
    assertMessage<typeof EventNames.DEPOSIT_STARTED_EVENT>(msg, startedMsg, ["data.txHash"]);
  });

  initiator.once("DEPOSIT_CONFIRMED_EVENT", (msg) => {
    assertMessage<typeof EventNames.DEPOSIT_CONFIRMED_EVENT>(msg, confirmMsg);
  });

  responder.once("DEPOSIT_CONFIRMED_EVENT", (msg) => {
    assertMessage<typeof EventNames.DEPOSIT_CONFIRMED_EVENT>(msg, confirmMsg);
  });
}

describe("Node method follows spec - deposit", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;
  let provider: providers.JsonRpcProvider;
  let multisigAddress: string;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    provider = global["wallet"].provider;

    multisigAddress = await createChannel(nodeA, nodeB);
    expect(multisigAddress).toBeDefined();
    nodeA.off("DEPOSIT_CONFIRMED_EVENT");
    nodeB.off("DEPOSIT_CONFIRMED_EVENT");
  });

  it("has the right balance before an ERC20 deposit has been made", async () => {
    const erc20AssetId = getAddressFromAssetId(
      (global["contracts"] as TestContractAddresses).DolphinCoin,
    );

    const freeBalanceState = await getFreeBalanceState(nodeA, multisigAddress, erc20AssetId);

    expect(Object.values(freeBalanceState)).toMatchObject([Zero, Zero]);
  });

  it("has the right balance for both parties after eth deposits", async () => {
    const preDepositBalance = await provider.getBalance(multisigAddress);

    await deposit(nodeB, multisigAddress, One, nodeA);
    await confirmEthAndERC20FreeBalances(
      nodeA,
      nodeB,
      multisigAddress,
      AddressZero,
      [Zero, One], // balA, balB
    );

    await deposit(nodeA, multisigAddress, One, nodeB);
    await confirmEthAndERC20FreeBalances(nodeA, nodeB, multisigAddress, AddressZero, [One, One]);

    expect(await provider.getBalance(multisigAddress)).toBeEq(preDepositBalance.add(2));
  });

  it("has the right balance for both parties after erc20 deposits", async () => {
    const erc20AssetId = getAddressFromAssetId(
      (global["contracts"] as TestContractAddresses).DolphinCoin,
    );

    const tokenAddress = getAddressFromAssetId(erc20AssetId);

    const erc20Contract = new Contract(
      getAddressFromAssetId(erc20AssetId),
      DolphinCoin.abi,
      global["wallet"].provider,
    );
    const preDepositERC20Balance = await erc20Contract.balanceOf(multisigAddress);

    await transferERC20Tokens(await nodeA.signerAddress);
    await transferERC20Tokens(await nodeB.signerAddress);

    await deposit(nodeB, multisigAddress, One, nodeA, erc20AssetId);
    await confirmEthAndERC20FreeBalances(nodeA, nodeB, multisigAddress, tokenAddress, undefined, [
      Zero,
      One,
    ]);

    await deposit(nodeA, multisigAddress, One, nodeB, erc20AssetId);
    await confirmEthAndERC20FreeBalances(nodeA, nodeB, multisigAddress, tokenAddress, undefined, [
      One,
      One,
    ]);
    expect(await erc20Contract.balanceOf(multisigAddress)).toEqual(preDepositERC20Balance.add(Two));
  });

  it("updates balances correctly when depositing both ERC20 tokens and ETH", async () => {
    const erc20AssetId = getAddressFromAssetId(
      (global["contracts"] as TestContractAddresses).DolphinCoin,
    );

    const tokenAddress = getAddressFromAssetId(erc20AssetId);
    const erc20Contract = new Contract(tokenAddress, DolphinCoin.abi, global["wallet"].provider);

    await transferERC20Tokens(await nodeA.signerAddress);
    await transferERC20Tokens(await nodeB.signerAddress);

    const preDepositEthBalance = await provider.getBalance(multisigAddress);
    const preDepositERC20Balance = await erc20Contract.balanceOf(multisigAddress);

    await deposit(nodeA, multisigAddress, One, nodeB, erc20AssetId);
    await confirmEthAndERC20FreeBalances(nodeA, nodeB, multisigAddress, tokenAddress, undefined, [
      One,
      Zero,
    ]);

    await deposit(nodeB, multisigAddress, One, nodeA, erc20AssetId);
    await confirmEthAndERC20FreeBalances(nodeA, nodeB, multisigAddress, tokenAddress, undefined, [
      One,
      One,
    ]);

    expect(await provider.getBalance(multisigAddress)).toEqual(preDepositEthBalance);

    expect(await erc20Contract.balanceOf(multisigAddress)).toEqual(preDepositERC20Balance.add(Two));

    // now deposits ETH

    await deposit(nodeA, multisigAddress, One, nodeB);
    await confirmEthAndERC20FreeBalances(
      nodeA,
      nodeB,
      multisigAddress,
      tokenAddress,
      [One, Zero],
      [One, One],
    );

    await deposit(nodeB, multisigAddress, One, nodeA);
    await confirmEthAndERC20FreeBalances(
      nodeA,
      nodeB,
      multisigAddress,
      tokenAddress,
      [One, One],
      [One, One],
    );
    expect(await provider.getBalance(multisigAddress)).toBeEq(preDepositEthBalance.add(2));
  });
});

async function confirmEthAndERC20FreeBalances(
  channelInitiator: CFCore,
  channelResponder: CFCore,
  multisigAddress: string,
  tokenAddress: string,
  ethExpected: [BigNumber, BigNumber] = [Zero, Zero],
  erc20Expected: [BigNumber, BigNumber] = [Zero, Zero],
) {
  const eth = deBigNumberifyJson({
    [channelInitiator.signerAddress]: ethExpected[0],
    [channelResponder.signerAddress]: ethExpected[1],
  });
  const token = deBigNumberifyJson({
    [channelInitiator.signerAddress]: erc20Expected[0],
    [channelResponder.signerAddress]: erc20Expected[1],
  });
  for (const node of [channelInitiator, channelResponder]) {
    const tokenIndexedFreeBalances = await getTokenIndexedFreeBalanceStates(node, multisigAddress);

    const ethFreeBalance = await getFreeBalanceState(
      node,
      multisigAddress,
      getAddressFromAssetId(AddressZero),
    );
    const tokenFreeBalance = await getFreeBalanceState(
      node,
      multisigAddress,
      getAddressFromAssetId(tokenAddress),
    );
    // validate eth
    expect(deBigNumberifyJson(tokenIndexedFreeBalances[AddressZero] || {})).toMatchObject(eth);
    expect(deBigNumberifyJson(ethFreeBalance)).toMatchObject(eth);

    // validate tokens
    expect(deBigNumberifyJson(tokenIndexedFreeBalances[tokenAddress] || {})).toMatchObject(
      tokenAddress === AddressZero ? eth : token,
    );
    expect(deBigNumberifyJson(tokenFreeBalance)).toMatchObject(
      tokenAddress === AddressZero ? eth : token,
    );
  }
}
