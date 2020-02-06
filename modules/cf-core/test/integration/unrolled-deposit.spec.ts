import { AddressZero, One } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";

import { Node, NOT_YOUR_BALANCE_REFUND_APP } from "../../src";
import { CoinBalanceRefundState, ProtocolTypes } from "../../src/types";
import { toBeLt, toBeEq } from "../machine/integration/bignumber-jest-matcher";

import { setup, SetupContext } from "./setup";
import {
  createChannel,
  getBalances,
  getInstalledAppInstances,
  getProposedAppInstances,
  getProposeCoinBalanceRefundAppParams,
  rescindDepositRights,
  requestDepositRights,
  transferERC20Tokens
} from "./utils";
import { xkeyKthAddress } from "../../src/machine";
import { NetworkContextForTestSuite } from "@counterfactual/local-ganache-server";
import { INSTALL_EVENT } from "@connext/types";

expect.extend({ toBeLt, toBeEq });

describe(`Node method follows spec - install balance refund`, () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;
  let provider: JsonRpcProvider;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    provider = new JsonRpcProvider(global[`ganacheURL`]);
    nodeA = context[`A`].node;
    nodeB = context[`B`].node;

    multisigAddress = await createChannel(nodeA, nodeB);
  });

  it(`install app with ETH, sending ETH should increase free balance`, async done => {
    nodeB.on(`INSTALL_EVENT`, async () => {
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

      await rescindDepositRights(nodeA, multisigAddress);

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

    await requestDepositRights(nodeA, multisigAddress);
  });

  it(`install app with tokens, sending tokens should increase free balance`, async done => {
    const erc20TokenAddress = (global[
      `networkContext`
    ] as NetworkContextForTestSuite).DolphinCoin;

    nodeB.on(`INSTALL_EVENT`, async () => {
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

      await rescindDepositRights(nodeA, multisigAddress, erc20TokenAddress);

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

    await requestDepositRights(nodeA, multisigAddress, erc20TokenAddress);
  });

  it(`install app with both eth and tokens, sending eth and tokens should increase free balance`, async done => {
    const erc20TokenAddress = (global[
      `networkContext`
    ] as NetworkContextForTestSuite).DolphinCoin;

    let installedCount = 0;
    nodeB.on(`INSTALL_EVENT`, async () => {
      installedCount += 1;
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect(
        (appInstanceNodeA.latestState as CoinBalanceRefundState).recipient
      ).toBe(xkeyKthAddress(nodeA.publicIdentifier, 0));

      const proposedAppsA = await getProposedAppInstances(nodeA);
      expect(proposedAppsA.length).toBe(0);

      // wait for both apps to install
      if (installedCount < 2) {
        return;
      }

      // tokens
      const [preSendBalAToken, preSendBalBToken] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress
      );
      expect(preSendBalAToken).toBeEq(0);
      expect(preSendBalBToken).toBeEq(0);

      await transferERC20Tokens(multisigAddress, erc20TokenAddress);

      await rescindDepositRights(nodeA, multisigAddress, erc20TokenAddress);

      const [postSendBalAToken, postSendBalBToken] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress
      );
      expect(postSendBalAToken).toBeEq(1);
      expect(postSendBalBToken).toBeEq(0);

      // eth
      const [preSendBalAEth, preSendBalBEth] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero
      );
      expect(preSendBalAEth).toBeEq(0);
      expect(preSendBalBEth).toBeEq(0);

      const preDepositMultisig = await provider.getBalance(multisigAddress);
      const tx = await provider.getSigner().sendTransaction({
        to: multisigAddress,
        value: One
      });
      await provider.waitForTransaction(tx.hash!);
      const multisigBalance = await provider.getBalance(multisigAddress);
      expect(multisigBalance).toBeEq(preDepositMultisig.add(One));

      await rescindDepositRights(nodeA, multisigAddress);

      const [postSendBalAEth, postSendBalBEth] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero
      );
      expect(postSendBalAEth).toBeEq(1);
      expect(postSendBalBEth).toBeEq(0);

      done();
    });

    let parameters = await getProposeCoinBalanceRefundAppParams(
      multisigAddress,
      nodeA.publicIdentifier,
      nodeB.publicIdentifier,
      AddressZero
    );

    await new Promise(async res => {
      nodeB.once(`PROPOSE_INSTALL_EVENT`, data => res(data));
      await nodeA.rpcRouter.dispatch({
        id: Date.now(),
        methodName: ProtocolTypes.chan_proposeInstall,
        parameters
      });
    });

    await requestDepositRights(nodeA, multisigAddress);

    parameters = await getProposeCoinBalanceRefundAppParams(
      multisigAddress,
      nodeA.publicIdentifier,
      nodeB.publicIdentifier,
      erc20TokenAddress
    );

    await new Promise(async res => {
      nodeB.once(`PROPOSE_INSTALL_EVENT`, data => res(data));
      await nodeA.rpcRouter.dispatch({
        id: Date.now(),
        methodName: ProtocolTypes.chan_proposeInstall,
        parameters
      });
    });

    await requestDepositRights(nodeA, multisigAddress, erc20TokenAddress);
  });

  it(`install does not error if already installed`, async done => {
    nodeB.on(`INSTALL_EVENT`, async () => {
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect(
        (appInstanceNodeA.latestState as CoinBalanceRefundState).recipient
      ).toBe(xkeyKthAddress(nodeA.publicIdentifier, 0));
      done();
    });

    await requestDepositRights(nodeA, multisigAddress);
  });

  it(`uninstall does error if caller is not recipient`, async done => {
    await requestDepositRights(nodeA, multisigAddress);
    nodeB.once(INSTALL_EVENT, async () => {
      await expect(
        rescindDepositRights(nodeB, multisigAddress)
      ).rejects.toThrowError(NOT_YOUR_BALANCE_REFUND_APP);
      done();
    });
  });

  it(`can uninstall with no changes`, async done => {
    nodeB.on(`INSTALL_EVENT`, async () => {
      await rescindDepositRights(nodeA, multisigAddress);
      const appInstancesNodeA = await getInstalledAppInstances(nodeA);
      const appInstancesNodeB = await getInstalledAppInstances(nodeB);
      expect(appInstancesNodeA.length).toBe(0);
      expect(appInstancesNodeB.length).toBe(0);
      done();
    });

    await requestDepositRights(nodeA, multisigAddress);
  });

  it(`uninstall does not error if not installed`, async () => {
    await rescindDepositRights(nodeA, multisigAddress);
    const appInstancesNodeA = await getInstalledAppInstances(nodeA);
    const appInstancesNodeB = await getInstalledAppInstances(nodeB);
    expect(appInstancesNodeA.length).toBe(0);
    expect(appInstancesNodeB.length).toBe(0);
  });
});
