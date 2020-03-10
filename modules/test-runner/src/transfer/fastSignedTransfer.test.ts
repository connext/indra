import {
  IConnextClient,
  FastSignedTransferParameters,
  FAST_SIGNED_TRANSFER,
  FastSignedTransferAppStateBigNumber,
  bigNumberifyObj,
  CoinTransfer,
  ResolveFastSignedTransferParameters,
  FastSignedTransferResponse,
  delay,
} from "@connext/types";
import {
  hexlify,
  randomBytes,
  bigNumberify,
  BigNumber,
  solidityKeccak256,
  SigningKey,
  joinSignature,
} from "ethers/utils";
import { Wallet } from "ethers";
import { AddressZero, One, Zero } from "ethers/constants";

import { createClient, fundChannel, expect } from "../util";
import { xkeyKthAddress } from "@connext/cf-core";

describe("Fast Signed Transfer", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;

  beforeEach(async () => {
    clientA = await createClient();
    clientB = await createClient();
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("Should send a fast signed transfer", async () => {
    const paymentId = hexlify(randomBytes(32));
    const signerWallet = Wallet.createRandom();
    const signerAddress = await signerWallet.getAddress();

    const initialChannelBalance = bigNumberify(10);
    const transferAmount = One;

    await fundChannel(clientA, initialChannelBalance);
    const { transferAppInstanceId } = (await clientA.conditionalTransfer({
      amount: transferAmount.toString(),
      conditionType: FAST_SIGNED_TRANSFER,
      paymentId,
      recipient: clientB.publicIdentifier,
      signer: signerAddress,
      assetId: AddressZero,
      meta: { foo: "bar" },
    } as FastSignedTransferParameters)) as FastSignedTransferResponse;

    let transferApp = await clientA.getAppInstanceDetails(transferAppInstanceId);
    expect(transferApp).to.be.ok;
    let transferAppState = transferApp.appInstance
      .latestState as FastSignedTransferAppStateBigNumber;

    let coinTransfers: CoinTransfer<BigNumber>[] = transferAppState.coinTransfers.map(
      bigNumberifyObj,
    );
    expect(coinTransfers[0][0]).eq(clientA.freeBalanceAddress);
    expect(coinTransfers[0][1]).eq(initialChannelBalance.sub(transferAmount));
    expect(coinTransfers[1][0]).eq(xkeyKthAddress(clientA.nodePublicIdentifier));
    expect(coinTransfers[1][1]).eq(Zero);

    // locked payments contains transfer info
    expect(transferAppState.amount).to.eq(transferAmount);
    expect(transferAppState.paymentId).to.eq(paymentId);
    expect(transferAppState.recipientXpub).to.eq(clientB.publicIdentifier);
    expect(transferAppState.signer).to.eq(signerAddress);
    expect(transferAppState.turnNum).to.eq(One);

    const data = hexlify(randomBytes(32));

    const withdrawerSigningKey = new SigningKey(signerWallet.privateKey);
    const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
    const signature = joinSignature(withdrawerSigningKey.signDigest(digest));

    const res = await clientB.resolveCondition({
      conditionType: FAST_SIGNED_TRANSFER,
      paymentId,
      signature,
      data,
    } as ResolveFastSignedTransferParameters);

    // locked payment can resolve
    transferApp = await clientB.getAppInstanceDetails(res.appId);
    transferAppState = transferApp.appInstance.latestState as FastSignedTransferAppStateBigNumber;
    coinTransfers = transferAppState.coinTransfers.map(bigNumberifyObj);
    expect(coinTransfers[0][0]).eq(xkeyKthAddress(clientB.nodePublicIdentifier));
    expect(coinTransfers[1][0]).eq(clientB.freeBalanceAddress);
    expect(coinTransfers[1][1]).eq(Zero.add(transferAmount));
  });

  it.only("Should send multiple fast signed transfers using the same app", async () => {
    const signerWallet = Wallet.createRandom();
    const signerAddress = await signerWallet.getAddress();

    const initialChannelBalance = bigNumberify(10);
    const transferAmount = One;

    await fundChannel(clientA, initialChannelBalance);

    let initialSenderAppInstanceId: string = "";
    let initialReceiverAppInstanceId: string = "";
    for (let i = 0; i < 10; i++) {
      const paymentId = hexlify(randomBytes(32));
      const { transferAppInstanceId } = (await clientA.conditionalTransfer({
        amount: transferAmount.toString(),
        conditionType: FAST_SIGNED_TRANSFER,
        paymentId,
        recipient: clientB.publicIdentifier,
        signer: signerAddress,
        assetId: AddressZero,
        meta: { foo: "bar" },
      } as FastSignedTransferParameters)) as FastSignedTransferResponse;
      if (i === 0) {
        initialSenderAppInstanceId = transferAppInstanceId;
      }
      expect(transferAppInstanceId).to.eq(initialSenderAppInstanceId);

      const data = hexlify(randomBytes(32));

      const withdrawerSigningKey = new SigningKey(signerWallet.privateKey);
      const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
      const signature = joinSignature(withdrawerSigningKey.signDigest(digest));

      const res = await clientB.resolveCondition({
        conditionType: FAST_SIGNED_TRANSFER,
        paymentId,
        signature,
        data,
      } as ResolveFastSignedTransferParameters);
      if (i === 0) {
        initialReceiverAppInstanceId = res.appId;
      }
      expect(res.appId).to.be.eq(initialReceiverAppInstanceId);
      await delay(1000);
    }
    await delay(5000);

    // locked payment can resolve
    const transferApp = await clientB.getAppInstanceDetails(initialReceiverAppInstanceId);
    const transferAppState = transferApp.appInstance
      .latestState as FastSignedTransferAppStateBigNumber;
    const coinTransfers = transferAppState.coinTransfers.map(bigNumberifyObj);
    expect(coinTransfers[0][0]).eq(xkeyKthAddress(clientB.nodePublicIdentifier));
    expect(coinTransfers[1][0]).eq(clientB.freeBalanceAddress);
    expect(coinTransfers[1][1]).eq(10);
  });
});
