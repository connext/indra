import { xkeyKthAddress } from "@connext/cf-core";
import { IChannelProvider, IConnextClient, SwapParameters } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import {
  calculateExchange,
  createChannelProvider,
  createClient,
  createRemoteClient,
  ETH_AMOUNT_MD,
  ETH_AMOUNT_SM,
  TOKEN_AMOUNT,
  withdrawFromChannel,
} from "../util";

describe("ChannelProvider", () => {
  let clientA: IConnextClient;
  let clientA1: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;
  let channelProvider: IChannelProvider;

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    channelProvider = await createChannelProvider(clientA);
    clientA1 = await createRemoteClient(channelProvider);
  }, 90_000);

  // tslint:disable-next-line:max-line-length
  test("Happy case: client A1 can be instantiated with a channelProvider generated from client A", async () => {
    // tslint:disable-next-line:variable-name
    const _tokenAddress = clientA1.config.contractAddresses.Token;
    // tslint:disable-next-line:variable-name
    const _nodePublicIdentifier = clientA1.config.nodePublicIdentifier;
    // tslint:disable-next-line:variable-name
    const _nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);

    expect(_tokenAddress).toBe(tokenAddress);
    expect(_nodePublicIdentifier).toBe(nodePublicIdentifier);
    expect(_nodeFreeBalanceAddress).toBe(nodeFreeBalanceAddress);
  });

  // tslint:disable-next-line:max-line-length
  test("Happy case: Bot A1 can call the full deposit → swap → transfer → withdraw flow on Bot A", async () => {
    ////////////////////////////////////////
    // DEPOSIT FLOW
    // client deposit and request node collateral
    const depositAmount = ETH_AMOUNT_MD;
    await clientA1.deposit({ amount: depositAmount.toString(), assetId: AddressZero });
    await clientA1.requestCollateral(tokenAddress);

    ////////////////////////////////////////
    // SWAP FLOW
    // check balances pre
    const {
      [clientA1.freeBalanceAddress]: preSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceEthNode,
    } = await clientA1.getFreeBalance(AddressZero);
    expect(preSwapFreeBalanceEthClient).toBeBigNumberEq(depositAmount);
    expect(preSwapFreeBalanceEthNode).toBeBigNumberEq(Zero);

    const {
      [clientA1.freeBalanceAddress]: preSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: preSwapFreeBalanceTokenNode,
    } = await clientA1.getFreeBalance(tokenAddress);
    expect(preSwapFreeBalanceTokenNode).toBeBigNumberEq(TOKEN_AMOUNT);
    expect(preSwapFreeBalanceTokenClient).toBeBigNumberEq(Zero);

    const swapRate = await clientA1.getLatestSwapRate(AddressZero, tokenAddress);

    const swapAmount = ETH_AMOUNT_SM;
    const swapParams: SwapParameters = {
      amount: swapAmount.toString(),
      fromAssetId: AddressZero,
      swapRate,
      toAssetId: tokenAddress,
    };
    await clientA1.swap(swapParams);

    const {
      [clientA1.freeBalanceAddress]: postSwapFreeBalanceEthClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceEthNode,
    } = await clientA1.getFreeBalance(AddressZero);
    const {
      [clientA1.freeBalanceAddress]: postSwapFreeBalanceTokenClient,
      [nodeFreeBalanceAddress]: postSwapFreeBalanceTokenNode,
    } = await clientA1.getFreeBalance(tokenAddress);

    expect(postSwapFreeBalanceEthClient).toBeBigNumberEq(
      preSwapFreeBalanceEthClient.sub(swapAmount),
    );
    expect(postSwapFreeBalanceEthNode).toBeBigNumberEq(swapAmount);

    const expectedTokenSwapAmount = calculateExchange(swapAmount, swapRate);
    expect(postSwapFreeBalanceTokenClient).toBeBigNumberEq(expectedTokenSwapAmount);
    expect(postSwapFreeBalanceTokenNode).toBeBigNumberEq(
      preSwapFreeBalanceTokenNode.sub(expectedTokenSwapAmount.toString()),
    );

    ////////////////////////////////////////
    // TRANSFER FLOW
    const transferAmount = ETH_AMOUNT_SM;
    const clientB = await createClient();
    await clientA1.deposit({ amount: transferAmount.toString(), assetId: AddressZero });
    await clientB.requestCollateral(AddressZero);

    const {
      [clientA1.freeBalanceAddress]: preTransferFreeBalanceEthClientA1,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeA1,
    } = await clientA1.getFreeBalance(AddressZero);

    const {
      [clientB.freeBalanceAddress]: preTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: preTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(AddressZero);

    expect(preTransferFreeBalanceEthClientA1).toBeBigNumberEq(transferAmount);
    expect(preTransferFreeBalanceEthNodeA1).toBeBigNumberEq(0);

    expect(preTransferFreeBalanceEthClientB).toBeBigNumberEq(0);
    expect(preTransferFreeBalanceEthNodeB).toBeBigNumberGte(transferAmount);

    let paymentId;
    await new Promise(async resolve => {
      let count = 0;
      clientA1.once("UNINSTALL_EVENT", async () => {
        count += 1;
        if (count === 2) {
          resolve();
        }
      });

      clientB.once("RECIEVE_TRANSFER_FINISHED_EVENT", async () => {
        count += 1;
        if (count === 2) {
          resolve();
        }
      });

      const { paymentId: senderPaymentId, preImage: linkedPreImage } = await clientA1.transfer({
        amount: transferAmount.toString(),
        assetId: AddressZero,
        meta: { hello: "world" },
        recipient: clientB.publicIdentifier,
      });
      paymentId = senderPaymentId;
    });
    expect((await clientB.getAppInstances()).length).toEqual(0);
    expect((await clientA1.getAppInstances()).length).toEqual(0);

    const {
      [clientA1.freeBalanceAddress]: postTransferFreeBalanceEthClientA1,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeA1,
    } = await clientA1.getFreeBalance(AddressZero);

    const {
      [clientB.freeBalanceAddress]: postTransferFreeBalanceEthClientB,
      [nodeFreeBalanceAddress]: postTransferFreeBalanceEthNodeB,
    } = await clientB.getFreeBalance(AddressZero);

    expect(postTransferFreeBalanceEthClientA1).toBeBigNumberEq(0);
    expect(postTransferFreeBalanceEthNodeA1).toBeBigNumberEq(transferAmount);

    expect(postTransferFreeBalanceEthClientB).toBeBigNumberEq(transferAmount);
    expect(postTransferFreeBalanceEthNodeB).toBeBigNumberEq(
      preTransferFreeBalanceEthNodeB.sub(transferAmount),
    );

    // verify payment
    const paymentA = await clientA1.getLinkedTransfer(paymentId);
    const paymentB = await clientB.getLinkedTransfer(paymentId);
    expect(paymentA).toMatchObject({
      amount: transferAmount.toString(),
      assetId: AddressZero,
      meta: { hello: "world" },
      paymentId,
      receiverPublicIdentifier: clientB.publicIdentifier,
      senderPublicIdentifier: clientA1.publicIdentifier,
      status: "RECLAIMED",
      type: "LINKED",
    });
    expect(paymentB).toMatchObject(paymentA);

    ////////////////////////////////////////
    // WITHDRAW FLOW
    await withdrawFromChannel(clientA1, postTransferFreeBalanceEthClientA1.toString(), AddressZero);
  });

  // tslint:disable-next-line:max-line-length
  test("Bot A1 tries to call a function when Bot A is offline", async () => {
    // close channelProvider connection
    clientA1.channelProvider.close();

    await expect(clientA1.getFreeBalance(AddressZero)).rejects.toThrowError(
      "RpcConnection: Timeout - JSON-RPC not responded within 30s",
    );
  });

  // tslint:disable-next-line:max-line-length
  test("Bot A1 tries to reject installing a proposed app that bot A has already installed?", async () => {
    // TODO: add test
  });
});
