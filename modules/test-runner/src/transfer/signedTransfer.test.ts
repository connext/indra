/* global before */
import {
  ConditionalTransferTypes,
  EventNames,
  NodeResponses,
  IConnextClient,
  PublicParams,
  SignedTransferStatus,
  EventPayloads,
} from "@connext/types";
import { getRandomChannelSigner } from "@connext/utils";
import { AddressZero } from "ethers/constants";
import { hexlify, randomBytes, solidityKeccak256 } from "ethers/utils";
import { providers } from "ethers";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  TOKEN_AMOUNT,
  env,
  requestCollateral,
} from "../util";

describe("Signed Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  const provider = new providers.JsonRpcProvider(env.ethProviderUrl);

  before(async () => {
    const currBlock = await provider.getBlockNumber();
    // the node uses a `TIMEOUT_BUFFER` on recipient of 100 blocks
    // so make sure the current block
    const TIMEOUT_BUFFER = 100;
    if (currBlock > TIMEOUT_BUFFER) {
      // no adjustment needed, return
      return;
    }
    for (let index = currBlock; index <= TIMEOUT_BUFFER + 1; index++) {
      await provider.send("evm_mine", []);
    }
  });

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    tokenAddress = clientA.config.contractAddresses.Token;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: clientA signed transfers eth to clientB through node, clientB is online", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));
    const signer = getRandomChannelSigner();
    const signerAddress = await signer.getAddress();

    const [, installed] = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        signer: signerAddress,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.SignedTransfer),
      new Promise((res, rej) => {
        clientB.once(
          EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT,
          (data: EventPayloads.SignedTransferCreated) => {
            res(data);
          },
        );
        clientA.once(EventNames.REJECT_INSTALL_EVENT, rej);
      }),
    ]);

    expect(installed).deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes[ConditionalTransferTypes.SignedTransfer],
      paymentId,
      sender: clientA.publicIdentifier,
      transferMeta: { signer: signerAddress },
      meta: { foo: "bar", recipient: clientB.publicIdentifier, sender: clientA.publicIdentifier },
    } as EventPayloads.SignedTransferCreated);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const data = hexlify(randomBytes(32));
    const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
    const signature = await signer.signMessage(digest);

    const [eventData] = await Promise.all([
      new Promise(async (res) => {
        clientA.once(
          EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
          (eventData: EventPayloads.SignedTransferCreated) => {
            res(eventData);
          },
        );
      }),
      new Promise((res) => {
        clientA.once(EventNames.UNINSTALL_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        data,
        signature,
      } as PublicParams.ResolveSignedTransfer),
    ]);
    expect(eventData).to.deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes[ConditionalTransferTypes.SignedTransfer],
      paymentId,
      sender: clientA.publicIdentifier,
      transferMeta: {
        data,
        signature,
      },
      meta: {
        foo: "bar",
        recipient: clientB.publicIdentifier,
        sender: clientA.publicIdentifier,
      },
    } as EventPayloads.SignedTransferUnlocked);

    const {
      [clientA.signerAddress]: clientAPostReclaimBal,
      [clientA.nodeSignerAddress]: nodePostReclaimBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostReclaimBal).to.eq(0);
    expect(nodePostReclaimBal).to.eq(nodePostTransferBal.add(transfer.amount));
    const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
      transfer.assetId,
    );
    expect(clientBPostTransferBal).to.eq(transfer.amount);
  });

  it("happy case: clientA signed transfers tokens to clientB through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));
    const signer = getRandomChannelSigner();
    const signerAddress = await signer.getAddress();

    const promises = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        signer: signerAddress,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.SignedTransfer),
      new Promise(async (res) => {
        clientB.once(
          EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT,
          (data: EventPayloads.SignedTransferCreated) => {
            res(data);
          },
        );
      }),
    ]);

    const [, installed] = promises;
    expect(installed).deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes[ConditionalTransferTypes.SignedTransfer],
      paymentId,
      transferMeta: { signer: signerAddress },
      meta: { foo: "bar", recipient: clientB.publicIdentifier, sender: clientA.publicIdentifier },
    } as Partial<EventPayloads.SignedTransferCreated>);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const data = hexlify(randomBytes(32));
    const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
    const signature = await signer.signMessage(digest);

    await new Promise(async (res) => {
      clientA.on(EventNames.UNINSTALL_EVENT, async (data) => {
        const {
          [clientA.signerAddress]: clientAPostReclaimBal,
          [clientA.nodeSignerAddress]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(nodePostTransferBal.add(transfer.amount));
        res();
      });
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        data,
        signature,
      } as PublicParams.ResolveSignedTransfer);
      const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
        transfer.assetId,
      );
      expect(clientBPostTransferBal).to.eq(transfer.amount);
    });
  });

  it("gets a pending signed transfer by lock hash", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));
    const signer = getRandomChannelSigner();
    const signerAddress = await signer.getAddress();

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      signer: signerAddress,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.SignedTransfer);

    const retrievedTransfer = await clientB.getSignedTransfer(paymentId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      paymentId,
      senderIdentifier: clientA.publicIdentifier,
      status: SignedTransferStatus.PENDING,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as NodeResponses.GetSignedTransfer);
  });

  it("gets a completed signed transfer by lock hash", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));
    const signer = getRandomChannelSigner();
    const signerAddress = await signer.getAddress();

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      signer: signerAddress,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.SignedTransfer);
    // disconnect so that it cant be unlocked
    await clientA.messaging.disconnect();

    const data = hexlify(randomBytes(32));
    const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
    const signature = await signer.signMessage(digest);

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
      clientB.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        data,
        paymentId,
        signature,
      });
    });
    const retrievedTransfer = await clientB.getSignedTransfer(paymentId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      paymentId,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: SignedTransferStatus.COMPLETED,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as NodeResponses.GetSignedTransfer);
  });

  it("cannot resolve a signed transfer if signature is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));
    const signer = getRandomChannelSigner();
    const signerAddress = await signer.getAddress();

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      signer: signerAddress,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.SignedTransfer);

    const badSig = hexlify(randomBytes(65));
    const data = hexlify(randomBytes(32));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        data,
        paymentId,
        signature: badSig,
      } as PublicParams.ResolveSignedTransfer),
    ).to.eventually.be.rejectedWith(/VM Exception while processing transaction/);
  });

  // average time in multichannel test
  it.skip("Experimental: Average latency of 5 signed transfers with Eth", async () => {
    let runTime: number[] = [];
    let sum = 0;
    const numberOfRuns = 5;
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const signer = getRandomChannelSigner();
    const signerAddress = signer.address;

    await fundChannel(clientA, transfer.amount.mul(25), transfer.assetId);
    await requestCollateral(clientB, transfer.assetId);

    for (let i = 0; i < numberOfRuns; i++) {
      const { [clientA.signerAddress]: clientAPreBal } = await clientA.getFreeBalance(
        transfer.assetId,
      );
      const {
        [clientB.signerAddress]: clientBPreBal,
        [clientB.nodeSignerAddress]: nodeBPreBal,
      } = await clientB.getFreeBalance(transfer.assetId);
      const data = hexlify(randomBytes(32));
      const paymentId = hexlify(randomBytes(32));

      // Start timer
      const start = Date.now();

      // TODO: what are these errors
      await new Promise(async (res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, async (data) => {
          res();
        });
        await clientA.conditionalTransfer({
          amount: transfer.amount,
          conditionType: ConditionalTransferTypes[ConditionalTransferTypes.SignedTransfer],
          paymentId,
          signer: signerAddress,
          assetId: transfer.assetId,
          meta: { foo: "bar", sender: clientA.publicIdentifier },
          recipient: clientB.publicIdentifier,
        } as PublicParams.SignedTransfer);
      });

      // Including recipient signing in test to match real conditions
      const digest = solidityKeccak256(["bytes32", "bytes32"], [data, paymentId]);
      const signature = await signer.signMessage(digest);

      await new Promise(async (res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (data) => {
          res();
        });
        await clientB.resolveCondition({
          conditionType: ConditionalTransferTypes[ConditionalTransferTypes.SignedTransfer],
          paymentId,
          data,
          signature,
        } as PublicParams.ResolveSignedTransfer);
      });

      // Stop timer and add to sum
      runTime[i] = Date.now() - start;
      console.log(`Run: ${i}, Runtime: ${runTime[i]}`);
      sum = sum + runTime[i];

      const { [clientA.signerAddress]: clientAPostBal } = await clientA.getFreeBalance(
        transfer.assetId,
      );
      const {
        [clientB.signerAddress]: clientBPostBal,
        [clientB.nodeSignerAddress]: nodeBPostBal,
      } = await clientB.getFreeBalance(transfer.assetId);
      expect(clientAPostBal).to.eq(clientAPreBal.sub(transfer.amount));
      expect(nodeBPostBal).to.eq(nodeBPreBal.sub(transfer.amount));
      expect(clientBPostBal).to.eq(clientBPreBal.add(transfer.amount));
    }
    console.log(`Average = ${sum / numberOfRuns} ms`);
  });
});
