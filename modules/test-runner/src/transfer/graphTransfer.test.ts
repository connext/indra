import {
  Address,
  ConditionalTransferTypes,
  EventNames,
  EventPayloads,
  GraphReceipt,
  IConnextClient,
  NodeResponses,
  PrivateKey,
  PublicParams,
  SignedTransferStatus,
} from "@connext/types";
import {
  getChainId,
  getRandomPrivateKey,
  getTestGraphReceiptToSign,
  getTestVerifyingContract,
  signGraphReceiptMessage,
} from "@connext/utils";
import { providers, constants, utils } from "ethers";

import {
  createClient,
  ETH_AMOUNT_SM,
  ethProviderUrl,
  expect,
  fundChannel,
  getTestLoggers,
  TOKEN_AMOUNT,
} from "../util";

const { AddressZero } = constants;
const { hexlify, randomBytes } = utils;

const name = "Graph Signed Transfers";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let chainId: number;
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let privateKeyA: PrivateKey;
  let privateKeyB: PrivateKey;
  let provider: providers.JsonRpcProvider;
  let receipt: GraphReceipt;
  let start: number;
  let tokenAddress: Address;
  let verifyingContract: Address;

  before(async () => {
    start = Date.now();
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
    timeElapsed("beforeEach complete", start);
  });

  beforeEach(async () => {
    privateKeyA = getRandomPrivateKey();
    clientA = await createClient({ signer: privateKeyA, id: "A" });
    privateKeyB = getRandomPrivateKey();
    clientB = await createClient({ signer: privateKeyB, id: "B" });
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
    receipt = getTestGraphReceiptToSign();
    chainId = (await clientA.ethProvider.getNetwork()).chainId;
    verifyingContract = getTestVerifyingContract();
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
  });

  it("clientA signed transfers eth to clientB through node, clientB is online", async () => {
    const transfer = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));
    const transferPromise = clientB.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
    await clientA.conditionalTransfer({
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
    } as PublicParams.GraphTransfer);
    const installed = await transferPromise;

    expect(installed).deep.contain({
      amount: transfer.amount,
      appIdentityHash: installed.appIdentityHash,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.GraphTransfer,
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
        senderAssetId: transfer.assetId,
      },
    } as EventPayloads.GraphTransferCreated);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const signature = await signGraphReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      privateKeyB,
    );

    const unlockedPromise = clientA.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 10_000);
    const uninstalledPromise = clientA.waitFor(EventNames.UNINSTALL_EVENT, 10_000);
    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.GraphTransfer,
      paymentId,
      responseCID: receipt.responseCID,
      signature,
    } as PublicParams.ResolveGraphTransfer);

    const eventData = await unlockedPromise;
    await uninstalledPromise;

    expect(eventData).to.deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.GraphTransfer,
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
        senderAssetId: transfer.assetId,
        paymentId,
      },
    } as EventPayloads.GraphTransferUnlocked);

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

  it("clientA signed transfers tokens to clientB through node", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));

    const promises = await Promise.all([
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
      new Promise(async (res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
      }),
    ]);

    const [, installed] = promises;
    expect(installed).deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.GraphTransfer,
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
        senderAssetId: transfer.assetId,
        paymentId,
      },
    } as Partial<EventPayloads.GraphTransferCreated>);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const signature = await signGraphReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      privateKeyB,
    );

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
        conditionType: ConditionalTransferTypes.GraphTransfer,
        paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveGraphTransfer);
      const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
        transfer.assetId,
      );
      expect(clientBPostTransferBal).to.eq(transfer.amount);
    });
  });

  it("gets a pending signed transfer by lock hash", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.GraphTransfer,
      paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      recipient: clientB.publicIdentifier,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.GraphTransfer);

    const retrievedTransfer = await clientB.getGraphTransfer(paymentId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      paymentId,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: SignedTransferStatus.PENDING,
      meta: {
        foo: "bar",
        sender: clientA.publicIdentifier,
        paymentId,
        senderAssetId: transfer.assetId,
      },
    } as NodeResponses.GetSignedTransfer);
  });

  it("gets a completed signed transfer by lock hash", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));

    const receiverInstall = clientB.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.GraphTransfer,
      paymentId,
      recipient: clientB.publicIdentifier,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.GraphTransfer);
    await receiverInstall;
    // disconnect so that it cant be unlocked
    await clientA.off();

    const signature = await signGraphReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      privateKeyB,
    );

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      clientB.once(
        EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
        resolve,
        (data) => !!data.paymentId && data.paymentId === paymentId,
      );
      clientB.once(
        EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT,
        reject,
        (data) => !!data.paymentId && data.paymentId === paymentId,
      );
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.GraphTransfer,
        paymentId,
        responseCID: receipt.responseCID,
        signature,
      });
    });
    const retrievedTransfer = await clientB.getGraphTransfer(paymentId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      paymentId,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: SignedTransferStatus.COMPLETED,
      meta: {
        foo: "bar",
        sender: clientA.publicIdentifier,
        paymentId,
        senderAssetId: transfer.assetId,
      },
    } as NodeResponses.GetSignedTransfer);
  });

  it("cannot resolve a signed transfer if signature is wrong", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));

    const receiverInstalled = clientB.waitFor(
      EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT,
      10_000,
    );
    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.GraphTransfer,
      paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      recipient: clientB.publicIdentifier,
      verifyingContract,
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.GraphTransfer);
    await receiverInstalled;

    const badSig = hexlify(randomBytes(65));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.GraphTransfer,
        paymentId,
        responseCID: receipt.responseCID,
        signature: badSig,
      } as PublicParams.ResolveGraphTransfer),
    ).to.eventually.be.rejectedWith(/invalid signature/);
  });

  it("if sender uninstalls, node should force uninstall receiver first", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const paymentId = hexlify(randomBytes(32));

    const [transferRes, receiverRes] = await Promise.all([
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
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const paymentId = hexlify(randomBytes(32));

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

    // disconnect so receiver cannot uninstall
    await clientB.off();
    await clientB.off();

    await expect(clientA.uninstallApp((transferRes as any).appIdentityHash)).to.eventually.be
      .rejected;
  });

  it("sender cannot uninstall unfinalized app when receiver is finalized", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const paymentId = hexlify(randomBytes(32));
    const signature = await signGraphReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      privateKeyB,
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

    // disconnect so sender cannot unlock
    await clientA.off();

    await Promise.all([
      new Promise((res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.GraphTransfer,
        paymentId,
        responseCID: receipt.responseCID,
        signature,
      } as PublicParams.ResolveGraphTransfer),
    ]);

    clientA.messaging.connect();
    await expect(clientA.uninstallApp((transferRes as any).appIdentityHash)).to.eventually.be
      .rejected;
  });
});
