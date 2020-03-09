import {
  IConnextClient,
  FastSignedTransferParameters,
  FAST_SIGNED_TRANSFER,
  FastSignedTransferAppStateBigNumber,
  bigNumberifyObj,
  CoinTransfer,
  ResolveLinkedTransferParameters,
  ResolveFastSignedTransferResponse,
  ResolveFastSignedTransferParameters,
} from "@connext/types";
import {
  hexlify,
  randomBytes,
  bigNumberify,
  BigNumber,
  hexZeroPad,
  solidityKeccak256,
} from "ethers/utils";
import { Wallet } from "ethers";
import { AddressZero, One, HashZero, Zero } from "ethers/constants";

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

  it.only("Should send a fast signed transfer", async () => {
    const paymentId = hexlify(randomBytes(32));
    const signerWallet = Wallet.createRandom();
    const signerAddress = await signerWallet.getAddress();

    const initialChannelBalance = bigNumberify(10);
    const transferAmount = One;

    await fundChannel(clientA, initialChannelBalance);
    const { transferAppInstanceId }: any = await clientA.conditionalTransfer({
      amount: transferAmount.toString(),
      conditionType: FAST_SIGNED_TRANSFER,
      paymentId,
      recipient: clientB.publicIdentifier,
      signer: signerAddress,
      assetId: AddressZero,
      meta: { foo: "bar" },
    } as FastSignedTransferParameters);

    let transferApp = await clientA.getAppInstanceDetails(transferAppInstanceId);
    expect(transferApp).to.be.ok;
    let transferAppState = transferApp.appInstance
      .latestState as FastSignedTransferAppStateBigNumber;

    const coinTransfers: CoinTransfer<BigNumber>[] = transferAppState.coinTransfers.map(
      bigNumberifyObj,
    );
    expect(coinTransfers[0][0]).eq(clientA.freeBalanceAddress);
    expect(coinTransfers[0][1]).eq(initialChannelBalance.sub(transferAmount));
    expect(coinTransfers[1][0]).eq(xkeyKthAddress(clientA.nodePublicIdentifier));
    expect(coinTransfers[1][1]).eq(Zero);

    // locked payments contains transfer info
    const transfers = transferAppState.lockedPayments;
    expect(transfers.length).to.eq(1);
    const [transfer] = transfers;
    expect(transfer[0]).to.eq(clientB.publicIdentifier);
    expect(transfer[1]).to.eq(transferAmount);
    expect(transfer[2]).to.eq(signerAddress);
    expect(transfer[3]).to.eq(paymentId);
    expect(transfer[4]).to.eq(HashZero);
    expect(transfer[5]).to.eq(hexZeroPad(HashZero, 65));

    const data = hexlify(randomBytes(32));
    const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
    console.log("digest: ", digest);
    const signature = await signerWallet.signMessage(digest);
    console.log("signature: ", signature);

    await clientB.resolveCondition({
      conditionType: FAST_SIGNED_TRANSFER,
      paymentId,
      signature,
      data,
    } as ResolveFastSignedTransferParameters);

    transferApp = await clientA.getAppInstanceDetails(transferAppInstanceId);
    console.log("transferApp: ", transferApp);
    transferAppState = transferApp.appInstance.latestState as FastSignedTransferAppStateBigNumber;
    console.log("transferAppState: ", transferAppState);
  });
});
