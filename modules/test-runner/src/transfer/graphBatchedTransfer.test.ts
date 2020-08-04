/* global before */
import {
  ConditionalTransferTypes,
  EventNames,
  IConnextClient,
  PublicParams,
  EventPayloads,
  PrivateKey,
  Address,
  GRAPH_BATCHED_SWAP_CONVERSION,
  GraphReceipt,
  PublicResults,
} from "@connext/types";
import {
  getTestVerifyingContract,
  getTestGraphReceiptToSign,
  getRandomPrivateKey,
  signGraphReceiptMessage,
  getChainId,
  signGraphConsumerMessage,
  getRandomBytes32,
} from "@connext/utils";

import { providers, constants, utils, BigNumber } from "ethers";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_SM,
  ethProviderUrl,
  expect,
  fundChannel,
  TOKEN_AMOUNT,
} from "../util";

const { AddressZero, One } = constants;
const { hexlify, randomBytes } = utils;

const createBatchedTransfer = async (
  senderClient: IConnextClient,
  receiverClient: IConnextClient,
  transfer: AssetOptions,
  paymentId: string = getRandomBytes32(),
): Promise<{
  paymentId: string;
  chainId: number;
  verifyingContract: string;
  receipt: GraphReceipt;
  transferRes: PublicResults.GraphBatchedTransfer;
}> => {
  const chainId = senderClient.chainId;
  const verifyingContract = getTestVerifyingContract();
  const receipt = getTestGraphReceiptToSign();
  const transferPromise = receiverClient.waitFor(
    EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT,
    10_000,
  );
  const transferRes = await senderClient.conditionalTransfer({
    amount: transfer.amount,
    conditionType: ConditionalTransferTypes.GraphBatchedTransfer,
    paymentId,
    consumerSigner: senderClient.signerAddress,
    chainId,
    verifyingContract,
    subgraphDeploymentID: receipt.subgraphDeploymentID,
    assetId: transfer.assetId,
    recipient: receiverClient.publicIdentifier,
    meta: { foo: "bar" },
  } as PublicParams.GraphBatchedTransfer);
  const installed = await transferPromise;

  expect(installed).deep.contain({
    amount: transfer.amount,
    appIdentityHash: installed.appIdentityHash,
    assetId: transfer.assetId,
    type: ConditionalTransferTypes.GraphBatchedTransfer,
    paymentId,
    sender: senderClient.publicIdentifier,
    transferMeta: {
      consumerSigner: senderClient.signerAddress,
      attestationSigner: receiverClient.signerAddress,
      chainId,
      verifyingContract,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      swapRate: One.mul(GRAPH_BATCHED_SWAP_CONVERSION),
      requestCID: undefined,
    },
    meta: {
      foo: "bar",
      recipient: receiverClient.publicIdentifier,
      sender: senderClient.publicIdentifier,
      paymentId,
      senderAssetId: transfer.assetId,
    },
  } as EventPayloads.GraphBatchedTransferCreated);

  const {
    [senderClient.signerAddress]: clientAPostTransferBal,
  } = await senderClient.getFreeBalance(transfer.assetId);
  expect(clientAPostTransferBal).to.eq(0);

  return { paymentId, chainId, verifyingContract, receipt, transferRes };
};

const resolveBatchedTransfer = async (
  senderClient: IConnextClient,
  receiverClient: IConnextClient,
  transfer: AssetOptions,
  totalPaid: BigNumber,
  paymentId: string,
  privateKeyConsumer: string,
  privateKeyIndexer: string,
) => {
  const chainId = senderClient.chainId;
  const verifyingContract = getTestVerifyingContract();
  const receipt = getTestGraphReceiptToSign();
  const attestationSignature = await signGraphReceiptMessage(
    receipt,
    senderClient.chainId,
    verifyingContract,
    privateKeyIndexer,
  );

  const consumerSignature = await signGraphConsumerMessage(
    receipt,
    chainId,
    verifyingContract,
    totalPaid,
    paymentId,
    privateKeyConsumer,
  );

  const unlockedPromise = senderClient.waitFor(
    EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
    10_000,
  );
  const uninstalledPromise = senderClient.waitFor(EventNames.UNINSTALL_EVENT, 10_000);
  await receiverClient.resolveCondition({
    conditionType: ConditionalTransferTypes.GraphBatchedTransfer,
    totalPaid,
    paymentId,
    responseCID: receipt.responseCID,
    requestCID: receipt.requestCID,
    consumerSignature,
    attestationSignature,
  } as PublicParams.ResolveGraphBatchedTransfer);

  const eventData = await unlockedPromise;
  await uninstalledPromise;

  expect(eventData).to.deep.contain({
    amount: transfer.amount,
    assetId: transfer.assetId,
    type: ConditionalTransferTypes.GraphBatchedTransfer,
    paymentId,
    sender: senderClient.publicIdentifier,
    transferMeta: {
      totalPaid,
      requestCID: receipt.requestCID,
      responseCID: receipt.responseCID,
      consumerSignature,
      attestationSignature,
    },
    meta: {
      foo: "bar",
      recipient: receiverClient.publicIdentifier,
      sender: senderClient.publicIdentifier,
      paymentId,
      senderAssetId: transfer.assetId,
    },
  } as EventPayloads.GraphBatchedTransferUnlocked);

  const {
    [senderClient.signerAddress]: senderClientPostReclaimBal,
  } = await senderClient.getFreeBalance(transfer.assetId);
  const {
    [receiverClient.signerAddress]: receiverClientPostTransferBal,
  } = await receiverClient.getFreeBalance(transfer.assetId);
  expect(senderClientPostReclaimBal).to.eq(transfer.amount.sub(totalPaid));
  expect(receiverClientPostTransferBal).to.eq(totalPaid);
};

describe("Graph Batched Transfers", () => {
  let privateKeyA: PrivateKey;
  let clientA: IConnextClient;
  let privateKeyB: PrivateKey;
  let clientB: IConnextClient;
  let tokenAddress: Address;
  let provider: providers.JsonRpcProvider;
  before(async () => {
    provider = new providers.JsonRpcProvider(ethProviderUrl, await getChainId(ethProviderUrl));
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
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: clientA signed transfers eth to clientB through node, clientB is online", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const { paymentId } = await createBatchedTransfer(clientA, clientB, transfer);
    const totalPaid = transfer.amount.div(3);
    await resolveBatchedTransfer(
      clientA,
      clientB,
      transfer,
      totalPaid,
      paymentId,
      privateKeyA,
      privateKeyB,
    );
  });

  it("happy case: clientA signed transfers tokens to clientB through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const { paymentId } = await createBatchedTransfer(clientA, clientB, transfer);
    const totalPaid = transfer.amount.div(3);
    await resolveBatchedTransfer(
      clientA,
      clientB,
      transfer,
      totalPaid,
      paymentId,
      privateKeyA,
      privateKeyB,
    );
  });

  // it("gets a pending signed transfer by lock hash", async () => {
  //   const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
  //   await fundChannel(clientA, transfer.amount, transfer.assetId);
  //   const paymentId = hexlify(randomBytes(32));

  //   await clientA.conditionalTransfer({
  //     amount: transfer.amount,
  //     conditionType: ConditionalTransferTypes.GraphTransfer,
  //     paymentId,
  //     signerAddress: clientB.signerAddress,
  //     chainId,
  //     verifyingContract,
  //     requestCID: receipt.requestCID,
  //     subgraphDeploymentID: receipt.subgraphDeploymentID,
  //     recipient: clientB.publicIdentifier,
  //     assetId: transfer.assetId,
  //     meta: { foo: "bar", sender: clientA.publicIdentifier },
  //   } as PublicParams.GraphTransfer);

  //   const retrievedTransfer = await clientB.getGraphTransfer(paymentId);
  //   expect(retrievedTransfer).to.deep.equal({
  //     amount: transfer.amount.toString(),
  //     assetId: transfer.assetId,
  //     paymentId,
  //     senderIdentifier: clientA.publicIdentifier,
  //     receiverIdentifier: clientB.publicIdentifier,
  //     status: SignedTransferStatus.PENDING,
  //     meta: { foo: "bar", sender: clientA.publicIdentifier, paymentId },
  //   } as NodeResponses.GetSignedTransfer);
  // });

  // it("gets a completed signed transfer by lock hash", async () => {
  //   const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
  //   await fundChannel(clientA, transfer.amount, transfer.assetId);
  //   const paymentId = hexlify(randomBytes(32));

  //   const receiverInstall = clientB.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
  //   await clientA.conditionalTransfer({
  //     amount: transfer.amount,
  //     conditionType: ConditionalTransferTypes.GraphTransfer,
  //     paymentId,
  //     recipient: clientB.publicIdentifier,
  //     signerAddress: clientB.signerAddress,
  //     chainId,
  //     verifyingContract,
  //     requestCID: receipt.requestCID,
  //     subgraphDeploymentID: receipt.subgraphDeploymentID,
  //     assetId: transfer.assetId,
  //     meta: { foo: "bar", sender: clientA.publicIdentifier },
  //   } as PublicParams.GraphTransfer);
  //   await receiverInstall;
  //   // disconnect so that it cant be unlocked
  //   await clientA.messaging.disconnect();

  //   const signature = await signGraphReceiptMessage(
  //     receipt,
  //     chainId,
  //     verifyingContract,
  //     privateKeyB,
  //   );

  //   // wait for transfer to be picked up by receiver
  //   await new Promise(async (resolve, reject) => {
  //     clientB.once(
  //       EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
  //       resolve,
  //       (data) => !!data.paymentId && data.paymentId === paymentId,
  //     );
  //     clientB.once(
  //       EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT,
  //       reject,
  //       (data) => !!data.paymentId && data.paymentId === paymentId,
  //     );
  //     await clientB.resolveCondition({
  //       conditionType: ConditionalTransferTypes.GraphTransfer,
  //       paymentId,
  //       responseCID: receipt.responseCID,
  //       signature,
  //     });
  //   });
  //   const retrievedTransfer = await clientB.getGraphTransfer(paymentId);
  //   expect(retrievedTransfer).to.deep.equal({
  //     amount: transfer.amount.toString(),
  //     assetId: transfer.assetId,
  //     paymentId,
  //     senderIdentifier: clientA.publicIdentifier,
  //     receiverIdentifier: clientB.publicIdentifier,
  //     status: SignedTransferStatus.COMPLETED,
  //     meta: { foo: "bar", sender: clientA.publicIdentifier, paymentId },
  //   } as NodeResponses.GetSignedTransfer);
  // });

  it("cannot resolve a signed transfer if attestation signature is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const { paymentId, receipt, chainId, verifyingContract } = await createBatchedTransfer(
      clientA,
      clientB,
      transfer,
    );
    const totalPaid = transfer.amount.div(3);

    const consumerSignature = await signGraphConsumerMessage(
      receipt,
      chainId,
      verifyingContract,
      totalPaid,
      paymentId,
      privateKeyA,
    );

    const badSig = hexlify(randomBytes(65));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.GraphBatchedTransfer,
        totalPaid,
        paymentId,
        requestCID: receipt.requestCID,
        responseCID: receipt.responseCID,
        consumerSignature,
        attestationSignature: badSig,
      } as PublicParams.ResolveGraphBatchedTransfer),
    ).to.eventually.be.rejectedWith(/invalid signature/);
  });

  it("cannot resolve a signed transfer if attestation signature is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const { paymentId, receipt, chainId, verifyingContract } = await createBatchedTransfer(
      clientA,
      clientB,
      transfer,
    );
    const totalPaid = transfer.amount.div(3);

    const attestationSignature = await signGraphReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      privateKeyB,
    );

    const badSig = hexlify(randomBytes(65));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.GraphBatchedTransfer,
        totalPaid,
        paymentId,
        requestCID: receipt.requestCID,
        responseCID: receipt.responseCID,
        attestationSignature,
        consumerSignature: badSig,
      } as PublicParams.ResolveGraphBatchedTransfer),
    ).to.eventually.be.rejectedWith(/invalid signature/);
  });

  it("if sender uninstalls, node should force uninstall receiver first", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const receiverPromise = clientB.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
    const { transferRes } = await createBatchedTransfer(clientA, clientB, transfer);
    const receiverRes = (await receiverPromise) as EventPayloads.GraphBatchedTransferCreated;

    clientA.uninstallApp(transferRes.appIdentityHash);
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
    expect(winner.appIdentityHash).to.be.eq(receiverRes.appIdentityHash);
  });

  it("sender cannot uninstall before receiver", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const { transferRes } = await createBatchedTransfer(clientA, clientB, transfer);

    // disconnect so receiver cannot uninstall
    clientB.messaging.disconnect();
    clientB.off();

    await expect(clientA.uninstallApp(transferRes.appIdentityHash)).to.eventually.be.rejected;
  });

  it.only("sender cannot uninstall unfinalized app when receiver is finalized", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const { paymentId, chainId, verifyingContract, receipt } = await createBatchedTransfer(
      clientA,
      clientB,
      transfer,
    );

    const [transferRes] = await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.GraphTransfer,
        paymentId,
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        requestCID: receipt.requestCID,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        assetId: transfer.assetId,
        recipient: clientB.publicIdentifier,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
      } as PublicParams.GraphTransfer),
      new Promise((res, rej) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
        clientA.once(EventNames.REJECT_INSTALL_EVENT, rej);
      }),
    ]);

    const totalPaid = transfer.amount.div(3);
    // disconnect so sender cannot unlock
    clientA.messaging.disconnect();

    const attestationSignature = await signGraphReceiptMessage(
      receipt,
      clientA.chainId,
      verifyingContract,
      privateKeyB,
    );

    const consumerSignature = await signGraphConsumerMessage(
      receipt,
      chainId,
      verifyingContract,
      totalPaid,
      paymentId,
      privateKeyA,
    );

    await Promise.all([
      new Promise((res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.GraphBatchedTransfer,
        totalPaid,
        paymentId,
        responseCID: receipt.responseCID,
        requestCID: receipt.requestCID,
        consumerSignature,
        attestationSignature,
      } as PublicParams.ResolveGraphBatchedTransfer),
    ]);

    clientA.messaging.connect();
    await expect(clientA.uninstallApp((transferRes as any).appIdentityHash)).to.eventually.be
      .rejected;
  });
});
