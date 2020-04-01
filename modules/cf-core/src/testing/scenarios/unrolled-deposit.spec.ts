import { CoinBalanceRefundAppState, MethodNames, ProposeMessage, EventNames, InstallMessage } from "@connext/types";
import { AddressZero, One } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";

import { Node } from "../../node";
import { NOT_YOUR_BALANCE_REFUND_APP } from "../../errors";
import { xkeyKthAddress } from "../../xkeys";

import { toBeLt, toBeEq } from "../bignumber-jest-matcher";
import { setup, SetupContext } from "../setup";
import {
  createChannel,
  getBalances,
  getInstalledAppInstances,
  getProposedAppInstances,
  getProposeCoinBalanceRefundAppParams,
  rescindDepositRights,
  requestDepositRights,
  transferERC20Tokens,
  getAppInstance,
} from "../utils";

expect.extend({ toBeLt, toBeEq });

describe(`Node method follows spec - install balance refund`, () => {
  let multisigAddress: string;
  let nodeA: Node;
  let nodeB: Node;
  let provider: JsonRpcProvider;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    provider = global["wallet"].provider;
    nodeA = context[`A`].node;
    nodeB = context[`B`].node;

    multisigAddress = await createChannel(nodeA, nodeB);
  });

  it(`install app with ETH, sending ETH should increase free balance`, async done => {
    nodeB.on(EventNames.INSTALL_EVENT, async () => {
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect((appInstanceNodeA.latestState as CoinBalanceRefundAppState).recipient).toBe(
        xkeyKthAddress(nodeA.publicIdentifier, 0),
      );

      const proposedAppsA = await getProposedAppInstances(nodeA, multisigAddress);
      expect(proposedAppsA.length).toBe(0);

      const [preSendBalA, preSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero,
      );
      expect(preSendBalA).toBeEq(0);
      expect(preSendBalB).toBeEq(0);

      const preDepositMultisig = await provider.getBalance(multisigAddress);
      const tx = await provider.getSigner().sendTransaction({
        to: multisigAddress,
        value: One,
      });
      await provider.waitForTransaction(tx.hash!);
      const multisigBalance = await provider.getBalance(multisigAddress);
      expect(multisigBalance).toBeEq(preDepositMultisig.add(One));

      await rescindDepositRights(nodeA, multisigAddress);

      const [postSendBalA, postSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero,
      );
      expect(postSendBalA).toBeEq(1);
      expect(postSendBalB).toBeEq(0);

      done();
    });

    await requestDepositRights(nodeA, nodeB, multisigAddress);
  });

  it(`install app with tokens, sending tokens should increase free balance`, async done => {
    const erc20TokenAddress = global[`network`].DolphinCoin;

    nodeB.on(EventNames.INSTALL_EVENT, async () => {
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect((appInstanceNodeA.latestState as CoinBalanceRefundAppState).recipient).toBe(
        xkeyKthAddress(nodeA.publicIdentifier, 0),
      );

      const proposedAppsA = await getProposedAppInstances(nodeA, multisigAddress);
      expect(proposedAppsA.length).toBe(0);

      const [preSendBalA, preSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress,
      );
      expect(preSendBalA).toBeEq(0);
      expect(preSendBalB).toBeEq(0);

      await transferERC20Tokens(multisigAddress, erc20TokenAddress);

      await rescindDepositRights(nodeA, multisigAddress, erc20TokenAddress);

      const [postSendBalA, postSendBalB] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress,
      );
      expect(postSendBalA).toBeEq(1);
      expect(postSendBalB).toBeEq(0);

      done();
    });

    await requestDepositRights(nodeA, nodeB, multisigAddress, erc20TokenAddress);
  });

  it(`install app with both eth and tokens, sending eth and tokens should increase free balance`, async done => {
    const erc20TokenAddress = global[`network`].DolphinCoin;

    let installedCount = 0;
    nodeB.on(EventNames.INSTALL_EVENT, async (msg: InstallMessage) => {
      installedCount += 1;
      const appId = msg.data.params.appInstanceId;
      const appInstanceNodeA = await getAppInstance(nodeA, appId);
      const appInstanceNodeB = await getAppInstance(nodeB, appId);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect((appInstanceNodeA.latestState as CoinBalanceRefundAppState).recipient).toBe(nodeA.freeBalanceAddress);

      // wait for both apps to install
      if (installedCount < 2) {
        return;
      }

      const appsA = await getInstalledAppInstances(nodeA, multisigAddress);
      const appsB = await getInstalledAppInstances(nodeB, multisigAddress);
      expect(appsA.length).toBe(appsB.length);
      expect(appsA.length).toBe(2);
      const proposedAppsA = await getProposedAppInstances(nodeA, multisigAddress);
      expect(proposedAppsA.length).toBe(0);

      // tokens
      const [preSendBalAToken, preSendBalBToken] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress,
      );
      expect(preSendBalAToken).toBeEq(0);
      expect(preSendBalBToken).toBeEq(0);

      await transferERC20Tokens(multisigAddress, erc20TokenAddress);

      await rescindDepositRights(nodeA, multisigAddress, erc20TokenAddress);

      const [postSendBalAToken, postSendBalBToken] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        erc20TokenAddress,
      );
      expect(postSendBalAToken).toBeEq(1);
      expect(postSendBalBToken).toBeEq(0);

      // eth
      const [preSendBalAEth, preSendBalBEth] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero,
      );
      expect(preSendBalAEth).toBeEq(0);
      expect(preSendBalBEth).toBeEq(0);

      const preDepositMultisig = await provider.getBalance(multisigAddress);
      const tx = await provider.getSigner().sendTransaction({
        to: multisigAddress,
        value: One,
      });
      await provider.waitForTransaction(tx.hash!);
      const multisigBalance = await provider.getBalance(multisigAddress);
      expect(multisigBalance).toBeEq(preDepositMultisig.add(One));

      await rescindDepositRights(nodeA, multisigAddress);

      const [postSendBalAEth, postSendBalBEth] = await getBalances(
        nodeA,
        nodeB,
        multisigAddress,
        AddressZero,
      );
      expect(postSendBalAEth).toBeEq(1);
      expect(postSendBalBEth).toBeEq(0);

      done();
    });

    await requestDepositRights(nodeA, nodeB, multisigAddress, erc20TokenAddress);
    await requestDepositRights(nodeA, nodeB, multisigAddress);
  });

  it(`install does not error if already installed`, async done => {
    nodeB.on(EventNames.INSTALL_EVENT, async () => {
      const [appInstanceNodeA] = await getInstalledAppInstances(nodeA, multisigAddress);
      const [appInstanceNodeB] = await getInstalledAppInstances(nodeB, multisigAddress);
      expect(appInstanceNodeA).toBeDefined();
      expect(appInstanceNodeA).toEqual(appInstanceNodeB);
      expect((appInstanceNodeA.latestState as CoinBalanceRefundAppState).recipient).toBe(
        xkeyKthAddress(nodeA.publicIdentifier, 0),
      );
      done();
    });

    await requestDepositRights(nodeA, nodeB, multisigAddress);
  });

  it(`uninstall does error if caller is not recipient`, async done => {
    nodeB.once(EventNames.INSTALL_EVENT, async data => {
      await expect(rescindDepositRights(nodeB, multisigAddress)).rejects.toThrowError(
        NOT_YOUR_BALANCE_REFUND_APP,
      );
      done();
    });
    await requestDepositRights(nodeA, nodeB, multisigAddress);
  });

  it(`can uninstall with no changes`, async done => {
    nodeB.on(EventNames.INSTALL_EVENT, async () => {
      await rescindDepositRights(nodeA, multisigAddress);
      const appInstancesNodeA = await getInstalledAppInstances(nodeA, multisigAddress);
      const appInstancesNodeB = await getInstalledAppInstances(nodeB, multisigAddress);
      expect(appInstancesNodeA.length).toBe(0);
      expect(appInstancesNodeB.length).toBe(0);
      done();
    });

    await requestDepositRights(nodeA, nodeB, multisigAddress);
  });

  it(`uninstall does not error if not installed`, async () => {
    await rescindDepositRights(nodeA, multisigAddress);
    const appInstancesNodeA = await getInstalledAppInstances(nodeA, multisigAddress);
    const appInstancesNodeB = await getInstalledAppInstances(nodeB, multisigAddress);
    expect(appInstancesNodeA.length).toBe(0);
    expect(appInstancesNodeB.length).toBe(0);
  });
});
