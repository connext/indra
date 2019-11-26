import { AddressZero, One } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";

import { Node } from "../../src";
import {
  CoinBalanceRefundState,
  NODE_EVENTS,
  Node as NodeTypes
} from "../../src/types";
import { toBeLt, toBeEq } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  createChannel,
  getBalances,
  getInstalledAppInstances,
  getProposedAppInstances,
  transferERC20Tokens
} from "./utils";
import { xkeyKthAddress } from "../../src/machine";
import { NetworkContextForTestSuite } from "@counterfactual/local-ganache-server";

expect.extend({ toBeLt, toBeEq });

describe("Node method follows spec - install balance refund", () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;
  let provider: JsonRpcProvider;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    provider = new JsonRpcProvider(global["ganacheURL"]);
    nodeA = context["A"].node;
    nodeB = context["B"].node;

    multisigAddress = await createChannel(nodeA, nodeB);
  });

  it("install app with ETH, sending ETH should increase free balance", async done => {
    nodeB.on(NODE_EVENTS.INSTALL, async () => {
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect(
        (appInstanceNodeA.latestState as CoinBalanceRefundState).recipient
      ).toBe(xkeyKthAddress(nodeA.publicIdentifier, 0));

      const proposedAppsA = await getProposedAppInstances(nodeA);
      expect(proposedAppsA.length).toBe(0);

      const [preSendBalA, preSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero
      );
      expect(preSendBalA).toBeEq(0);
      expect(preSendBalB).toBeEq(0);

      const preDepositMultisig = await provider.getBalance(multisigAddress);
      const tx = await provider.getSigner().sendTransaction({
        to: multisigAddress,
        value: One
      });
      await provider.waitForTransaction(tx.hash!);
      const multisigBalance = await provider.getBalance(multisigAddress);
      expect(multisigBalance).toBeEq(preDepositMultisig.add(One));

      await nodeA.rpcRouter.dispatch({
        id: Date.now(),
        methodName: NodeTypes.RpcMethodName.RESCIND_DEPOSIT_RIGHTS,
        parameters: {
          multisigAddress
        } as NodeTypes.RescindDepositRightsParams
      });

      const [postSendBalA, postSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero
      );
      expect(postSendBalA).toBeEq(1);
      expect(postSendBalB).toBeEq(0);

      done();
    });

    await nodeA.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.REQUEST_DEPOSIT_RIGHTS,
      parameters: {
        multisigAddress,
        tokenAddress: AddressZero
      } as NodeTypes.RequestDepositRightsParams
    });
  });

  it("install app with tokens, sending tokens should increase free balance", async done => {
    const erc20TokenAddress = (global[
      "networkContext"
    ] as NetworkContextForTestSuite).DolphinCoin;

    nodeB.on(NODE_EVENTS.INSTALL, async () => {
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect(
        (appInstanceNodeA.latestState as CoinBalanceRefundState).recipient
      ).toBe(xkeyKthAddress(nodeA.publicIdentifier, 0));

      const proposedAppsA = await getProposedAppInstances(nodeA);
      expect(proposedAppsA.length).toBe(0);

      const [preSendBalA, preSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress
      );
      expect(preSendBalA).toBeEq(0);
      expect(preSendBalB).toBeEq(0);

      await transferERC20Tokens(multisigAddress, erc20TokenAddress);

      await nodeB.rpcRouter.dispatch({
        id: Date.now(),
        methodName: NodeTypes.RpcMethodName.RESCIND_DEPOSIT_RIGHTS,
        parameters: {
          multisigAddress
        } as NodeTypes.RescindDepositRightsParams
      });

      const [postSendBalA, postSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress
      );
      expect(postSendBalA).toBeEq(1);
      expect(postSendBalB).toBeEq(0);

      done();
    });

    await nodeA.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.REQUEST_DEPOSIT_RIGHTS,
      parameters: {
        multisigAddress,
        tokenAddress: erc20TokenAddress
      } as NodeTypes.RequestDepositRightsParams
    });
  });

  it("install does not error if already installed", async done => {
    nodeB.on(NODE_EVENTS.INSTALL, async () => {
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect(
        (appInstanceNodeA.latestState as CoinBalanceRefundState).recipient
      ).toBe(xkeyKthAddress(nodeA.publicIdentifier, 0));
      done();
    });

    await nodeA.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.REQUEST_DEPOSIT_RIGHTS,
      parameters: {
        multisigAddress,
        tokenAddress: AddressZero
      } as NodeTypes.RequestDepositRightsParams
    });
  });

  it("can uninstall with no changes", async done => {
    nodeB.on(NODE_EVENTS.INSTALL, async () => {
      await nodeB.rpcRouter.dispatch({
        id: Date.now(),
        methodName: NodeTypes.RpcMethodName.RESCIND_DEPOSIT_RIGHTS,
        parameters: {
          multisigAddress
        } as NodeTypes.RescindDepositRightsParams
      });
      const appInstancesNodeA = await getInstalledAppInstances(nodeA);
      const appInstancesNodeB = await getInstalledAppInstances(nodeB);
      expect(appInstancesNodeA.length).toBe(0);
      expect(appInstancesNodeB.length).toBe(0);
      done();
    });

    await nodeA.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.REQUEST_DEPOSIT_RIGHTS,
      parameters: {
        multisigAddress,
        tokenAddress: AddressZero
      } as NodeTypes.RequestDepositRightsParams
    });
  });

  it("uninstall does not error if not installed", async () => {
    await nodeA.rpcRouter.dispatch({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.RESCIND_DEPOSIT_RIGHTS,
      parameters: {
        multisigAddress
      } as NodeTypes.RescindDepositRightsParams
    });
    const appInstancesNodeA = await getInstalledAppInstances(nodeA);
    const appInstancesNodeB = await getInstalledAppInstances(nodeB);
    expect(appInstancesNodeA.length).toBe(0);
    expect(appInstancesNodeB.length).toBe(0);
  });
});
