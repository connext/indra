/* global before */
import {
  ConditionalTransferTypes,
  EventNames,
  NodeResponses,
  IConnextClient,
  PublicParams,
  SignedTransferStatus,
  EventPayloads,
  PrivateKey,
  Address,
  Receipt,
} from "@connext/types";
import {
  getTestVerifyingContract,
  getTestReceiptToSign,
  signReceiptMessage,
  getRandomPrivateKey,
} from "@connext/utils";

import { providers, constants, utils } from "ethers";

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

const { AddressZero } = constants;
const { hexlify, randomBytes } = utils;

describe("Signed Transfers", () => {
  let privateKeyA: PrivateKey;
  let clientA: IConnextClient;
  let privateKeyB: PrivateKey;
  let clientB: IConnextClient;
  let tokenAddress: Address;
  let receipt: Receipt;
  let chainId: number;
  let verifyingContract: Address;
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
    privateKeyA = getRandomPrivateKey();
    clientA = await createClient({ signer: privateKeyA, id: "A" });
    privateKeyB = getRandomPrivateKey();
    clientB = await createClient({ signer: privateKeyB, id: "B" });
    tokenAddress = clientA.config.contractAddresses.Token!;
    receipt = getTestReceiptToSign();
    chainId = (await clientA.ethProvider.getNetwork()).chainId;
    verifyingContract = getTestVerifyingContract();
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: clientA signed transfers eth to clientB through node, clientB is online", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));

    const [, installed] = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.SignedTransfer),
      new Promise((res, rej) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
        clientA.once(EventNames.REJECT_INSTALL_EVENT, rej);
      }),
    ]);

    expect(installed).deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      sender: clientA.publicIdentifier,
      transferMeta: {
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
      },
      meta: {
        foo: "bar",
        recipient: clientB.publicIdentifier,
        sender: clientA.publicIdentifier,
        paymentId,
      },
    } as EventPayloads.SignedTransferCreated);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const signature = await signReceiptMessage(receipt, chainId, verifyingContract, privateKeyB);

    const [eventData] = await Promise.all([
      new Promise(async (res) => {
        clientA.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      new Promise((res) => {
        clientA.once(EventNames.UNINSTALL_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveSignedTransfer),
    ]);
    expect(eventData).to.deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      sender: clientA.publicIdentifier,
      transferMeta: {
        responseCID: receipt.responseCID,
        signature,
      },
      meta: {
        foo: "bar",
        recipient: clientB.publicIdentifier,
        sender: clientA.publicIdentifier,
        paymentId,
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

    const promises = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.SignedTransfer),
      new Promise(async (res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
      }),
    ]);

    const [, installed] = promises;
    expect(installed).deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      transferMeta: {
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
      },
      meta: {
        foo: "bar",
        recipient: clientB.publicIdentifier,
        sender: clientA.publicIdentifier,
        paymentId,
      },
    } as Partial<EventPayloads.SignedTransferCreated>);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const signature = await signReceiptMessage(receipt, chainId, verifyingContract, privateKeyB);

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
        responseCID: receipt.responseCID,
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

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
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
      meta: { foo: "bar", sender: clientA.publicIdentifier, paymentId },
    } as NodeResponses.GetSignedTransfer);
  });

  it("gets a completed signed transfer by lock hash", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.SignedTransfer);
    // disconnect so that it cant be unlocked
    await clientA.messaging.disconnect();

    const signature = await signReceiptMessage(receipt, chainId, verifyingContract, privateKeyB);

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
      clientB.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        responseCID: receipt.responseCID,
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
      meta: { foo: "bar", sender: clientA.publicIdentifier, paymentId },
    } as NodeResponses.GetSignedTransfer);
  });

  it("cannot resolve a signed transfer if signature is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.SignedTransfer);

    const badSig = hexlify(randomBytes(65));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        responseCID: receipt.responseCID,
        signature: badSig,
      } as PublicParams.ResolveSignedTransfer),
    ).to.eventually.be.rejectedWith(/VM Exception while processing transaction/);
  });

  it("if sender uninstalls, node should force uninstall receiver first", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const paymentId = hexlify(randomBytes(32));

    const [transferRes, receiverRes] = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.SignedTransfer),
      new Promise((res, rej) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
        clientA.once(EventNames.REJECT_INSTALL_EVENT, rej);
      }),
    ]);

    clientA.uninstallApp((transferRes as any).appIdentityHash);
    const winner = await Promise.race([
      new Promise<EventPayloads.Uninstall>((res) => {
        clientA.once(
          EventNames.UNINSTALL_EVENT,
          res,
          (data) => data.appIdentityHash === (transferRes as any).appIdentityHash,
        );
      }),
      new Promise<EventPayloads.Uninstall>((res) => {
        clientB.once(EventNames.UNINSTALL_EVENT, res);
      }),
    ]);
    expect(winner.appIdentityHash).to.be.eq(
      (receiverRes as EventPayloads.SignedTransferCreated).appIdentityHash,
    );
  });

  it("sender cannot uninstall before receiver", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const paymentId = hexlify(randomBytes(32));

    const [transferRes] = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.SignedTransfer),
      new Promise((res, rej) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
        clientA.once(EventNames.REJECT_INSTALL_EVENT, rej);
      }),
    ]);

    // disconnect so receiver cannot uninstall
    clientB.messaging.disconnect();
    clientB.off();

    await expect(clientA.uninstallApp((transferRes as any).appIdentityHash)).to.eventually.be
      .rejected;
  });

  it("sender cannot uninstall unfinalized app when receiver is finalized", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const paymentId = hexlify(randomBytes(32));
    const signature = await signReceiptMessage(receipt, chainId, verifyingContract, privateKeyB);

    const [transferRes] = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.SignedTransfer),
      new Promise((res, rej) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
        clientA.once(EventNames.REJECT_INSTALL_EVENT, rej);
      }),
    ]);

    // disconnect so sender cannot unlock
    clientA.messaging.disconnect();

    await Promise.all([
      new Promise((res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveSignedTransfer),
    ]);

    clientA.messaging.connect();
    await expect(clientA.uninstallApp((transferRes as any).appIdentityHash)).to.eventually.be
      .rejected;
  });

  // average time in multichannel test
  it.skip("Experimental: Average latency of 5 signed transfers with Eth", async () => {
    const runTime: number[] = [];
    let sum = 0;
    const numberOfRuns = 5;
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };

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
      const paymentId = hexlify(randomBytes(32));

      // Start timer
      const start = Date.now();

      // TODO: what are these errors
      // eslint-disable-next-line no-loop-func
      await new Promise(async (res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, async (data) => {
          res();
        });
        await clientA.conditionalTransfer({
          amount: transfer.amount,
          conditionType: ConditionalTransferTypes.SignedTransfer,
          paymentId,
          signerAddress: clientB.signerAddress,
          chainId,
          verifyingContract,
          requestCID: receipt.requestCID,
          subgraphDeploymentID: receipt.subgraphDeploymentID,
          assetId: transfer.assetId,
          meta: { foo: "bar", sender: clientA.publicIdentifier },
          recipient: clientB.publicIdentifier,
        } as PublicParams.SignedTransfer);
      });

      // Including recipient signing in test to match real conditions
      const signature = await signReceiptMessage(receipt, chainId, verifyingContract, privateKeyB);
      // eslint-disable-next-line no-loop-func
      await new Promise(async (res) => {
        clientA.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async (data) => {
          res();
        });
        await clientB.resolveCondition({
          conditionType: ConditionalTransferTypes.SignedTransfer,
          paymentId,
          responseCID: receipt.responseCID,
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
