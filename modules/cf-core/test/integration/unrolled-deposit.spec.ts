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
  getFreeBalanceState
} from "./utils";
import { xkeyKthAddress } from "../../src/machine";

expect.extend({ toBeLt, toBeEq });

describe("Node method follows spec - install balance refund", () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;
  let provider: JsonRpcProvider;

  describe("Balance refund app is installed by node A", () => {
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

        const tx = await provider.getSigner().sendTransaction({
          to: multisigAddress,
          value: One
        });
        await provider.waitForTransaction(tx.hash!);
        const multisigBalance = await provider.getBalance(multisigAddress);
        console.log('multisigBalance: ', multisigBalance);
        expect(multisigBalance).toBeEq(1);

        const [app] = await getInstalledAppInstances(nodeA);
        console.log('app: ', app);

        await nodeA.rpcRouter.dispatch({
          id: Date.now(),
          methodName: NodeTypes.RpcMethodName.UNINSTALL_BALANCE_REFUND,
          parameters: {
            multisigAddress,
            tokenAddress: AddressZero
          } as NodeTypes.InstallBalanceRefundParams
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
        methodName: NodeTypes.RpcMethodName.INSTALL_BALANCE_REFUND,
        parameters: {
          multisigAddress,
          tokenAddress: AddressZero
        } as NodeTypes.InstallBalanceRefundParams
      });
    });
  });
});
