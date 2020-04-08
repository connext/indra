import { DepositAppState, BigNumber, getAddressFromIdentifier } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";

import { Node } from "../../node";

import { toBeLt, toBeEq } from "../bignumber-jest-matcher";
import { DolphinCoin } from "../contracts";
import { setup, SetupContext } from "../setup";
import {
  createChannel,
  getBalances,
  rescindDepositRights,
  requestDepositRights,
  transferERC20Tokens,
  getDepositApps,
  getMultisigBalance,
} from "../utils";

expect.extend({ toBeLt, toBeEq });

describe(`Node method follows spec - install deposit app`, () => {
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

  const runUnrolledDepositTest = async (
    assetId: string = AddressZero,
    depositAmt: BigNumber = new BigNumber(1000),
  ) => {
    // request rights
    const appIdentityHash = await requestDepositRights(nodeA, nodeB, multisigAddress, assetId);
    const appsA = await getDepositApps(nodeA, multisigAddress, [assetId]);
    const appsB = await getDepositApps(nodeB, multisigAddress, [assetId]);
    expect(appsA.length).toBe(appsB.length);
    expect(appsA.length).toBe(1);
    expect(appsA[0].identityHash).toBe(appIdentityHash);
    const transfers = (appsA[0].latestState as DepositAppState).transfers;
    expect(transfers[0].to).toBe(getAddressFromIdentifier(nodeA.publicIdentifier));
    expect(transfers[1].to).toBe(getAddressFromIdentifier(nodeB.publicIdentifier));

    // validate post-deposit free balance
    const [preSendBalA, preSendBalB] = await getBalances(
      nodeA,
      nodeB,
      multisigAddress,
      assetId,
    );
    expect(preSendBalA).toBeEq(0);
    expect(preSendBalB).toBeEq(0);

    // send tx
    const preDepositMultisig = await getMultisigBalance(multisigAddress, assetId);
    assetId === AddressZero
      ? await provider.getSigner().sendTransaction({
          to: multisigAddress,
          value: depositAmt,
        })
      : await transferERC20Tokens(
          multisigAddress,
          assetId,
          DolphinCoin.abi,
          depositAmt,
        );
    const multisigBalance = await getMultisigBalance(multisigAddress, assetId);
    expect(multisigBalance).toBeEq(preDepositMultisig.add(depositAmt));

    // rescind rights
    await rescindDepositRights(nodeA, nodeB, multisigAddress, assetId);
    const postRescindA = await getDepositApps(nodeA, multisigAddress, [assetId]);
    const postRescindB = await getDepositApps(nodeA, multisigAddress, [assetId]);
    expect(postRescindA.length).toBe(postRescindB.length);
    expect(postRescindA.length).toBe(0);

    // validate post-deposit free balance
    const [postSendBalA, postSendBalB] = await getBalances(
      nodeA,
      nodeB,
      multisigAddress,
      assetId,
    );
    expect(postSendBalA).toBeEq(depositAmt);
    expect(postSendBalB).toBeEq(0);
  };

  it(`install app with ETH, sending ETH should increase free balance`, async () => {
    await runUnrolledDepositTest();
  });

  it(`install app with tokens, sending tokens should increase free balance`, async () => {
    const depositAmt = new BigNumber(1000);
    const assetId = global[`network`].DolphinCoin;

    await runUnrolledDepositTest(assetId, depositAmt);;
  });

  it(`install app with both eth and tokens, sending eth and tokens should increase free balance`, async () => {
    const erc20TokenAddress = global[`network`].DolphinCoin;
    const depositAmtToken = new BigNumber(1000);
    const depositAmtEth = new BigNumber(500);

    // request deposit rights
    await requestDepositRights(
      nodeA,
      nodeB,
      multisigAddress,
    );
    await requestDepositRights(
      nodeA,
      nodeB,
      multisigAddress,
      erc20TokenAddress,
    );

    // pre-deposit free balances
    const [preSendBalAToken, preSendBalBToken] = await getBalances(
      nodeA,
      nodeB,
      multisigAddress,
      erc20TokenAddress,
    );
    expect(preSendBalAToken).toBeEq(0);
    expect(preSendBalBToken).toBeEq(0);

    const [preSendBalAEth, preSendBalBEth] = await getBalances(
      nodeA,
      nodeB,
      multisigAddress,
      AddressZero,
    );
    expect(preSendBalAEth).toBeEq(0);
    expect(preSendBalBEth).toBeEq(0);

    // send onchain transactions
    await transferERC20Tokens(multisigAddress, erc20TokenAddress, DolphinCoin.abi, depositAmtToken);
    const tx = await provider.getSigner().sendTransaction({
      to: multisigAddress,
      value: depositAmtEth,
    });
    await provider.waitForTransaction(tx.hash!);

    // rescind rights
    await rescindDepositRights(nodeA, nodeB, multisigAddress);
    await rescindDepositRights(nodeA, nodeB, multisigAddress, erc20TokenAddress);

    // post-deposit free balances
    const [postSendBalAEth, postSendBalBEth] = await getBalances(
      nodeA,
      nodeB,
      multisigAddress,
      AddressZero,
    );
    expect(postSendBalAEth).toBeEq(depositAmtEth);
    expect(postSendBalBEth).toBeEq(0);
    const [postSendBalAToken, postSendBalBToken] = await getBalances(
      nodeA,
      nodeB,
      multisigAddress,
      erc20TokenAddress,
    );
    expect(postSendBalAToken).toBeEq(depositAmtToken);
    expect(postSendBalBToken).toBeEq(0);
  });
});
