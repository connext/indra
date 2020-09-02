/* global before */
import {
  Address,
  ConditionalTransferTypes,
  EIP712Domain,
  EventNames,
  EventPayloads,
  IConnextClient,
  NodeResponses,
  PrivateKey,
  PublicParams,
  Receipt,
  SignedTransferStatus,
} from "@connext/types";
import {
  getChainId,
  getRandomBytes32,
  getRandomPrivateKey,
  getTestEIP712Domain,
  signReceiptMessage,
} from "@connext/utils";
import { providers, constants, utils } from "ethers";

import {
  AssetOptions,
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

const name = "Signed Transfers";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let chainId: number;
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let domainSeparator: EIP712Domain;
  let privateKeyA: PrivateKey;
  let privateKeyB: PrivateKey;
  let provider: providers.JsonRpcProvider;
  let receipt: Receipt;
  let start: number;
  let tokenAddress: Address;

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

  const sendSignedTransfer = async (
    transfer: AssetOptions,
    sender: IConnextClient = clientA,
    receiver: IConnextClient = clientB,
  ) => {
    const [transferRes, installed] = await Promise.all([
      sender.conditionalTransfer({
        amount: transfer.amount,
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: receipt.paymentId,
        signerAddress: receiver.signerAddress,
        chainId,
        verifyingContract: domainSeparator.verifyingContract,
        assetId: transfer.assetId,
        recipient: receiver.publicIdentifier,
        meta: { foo: "bar", sender: sender.publicIdentifier },
      }),
      new Promise((res, rej) => {
        receiver.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res);
        sender.once(EventNames.REJECT_INSTALL_EVENT, rej);
      }),
    ]);
    expect(installed).deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.SignedTransfer,
      paymentId: receipt.paymentId,
      sender: sender.publicIdentifier,
      transferMeta: {
        signerAddress: receiver.signerAddress,
        chainId,
        verifyingContract: domainSeparator.verifyingContract,
      },
      meta: {
        foo: "bar",
        recipient: receiver.publicIdentifier,
        sender: sender.publicIdentifier,
        paymentId: receipt.paymentId,
        senderAssetId: transfer.assetId,
      },
    } as EventPayloads.SignedTransferCreated);
    return [transferRes.appIdentityHash, (installed as any).appIdentityHash];
  };

  const resolveSignedTransfer = async (
    transfer: AssetOptions,
    signature: string,
    sender: IConnextClient = clientA,
    receiver: IConnextClient = clientB,
  ) => {
    const [eventData] = await Promise.all([
      new Promise(async (res) => {
        sender.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      new Promise((res) => {
        sender.once(EventNames.UNINSTALL_EVENT, res);
      }),
      receiver.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: receipt.paymentId,
        data: receipt.data,
        signature,
      } as PublicParams.ResolveSignedTransfer),
    ]);
    expect(eventData).to.deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.SignedTransfer,
      paymentId: receipt.paymentId,
      sender: sender.publicIdentifier,
      transferMeta: {
        data: receipt.data,
        signature,
      },
      meta: {
        foo: "bar",
        recipient: receiver.publicIdentifier,
        sender: sender.publicIdentifier,
        paymentId: receipt.paymentId,
        senderAssetId: transfer.assetId || AddressZero,
      },
    } as EventPayloads.SignedTransferUnlocked);
  };

  beforeEach(async () => {
    start = Date.now();
    privateKeyA = getRandomPrivateKey();
    const paymentId = getRandomBytes32();
    const data = getRandomBytes32();
    clientA = await createClient({ signer: privateKeyA, id: "A" });
    privateKeyB = getRandomPrivateKey();
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
    clientB = await createClient({ signer: privateKeyB, id: "B" });
    receipt = { paymentId, data };
    chainId = (await clientA.ethProvider.getNetwork()).chainId;
    domainSeparator = getTestEIP712Domain(chainId);
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
  });

  it("clientA signed transfers eth to clientB through node, clientB is online", async () => {
    const transfer = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await sendSignedTransfer(transfer);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const signature = await signReceiptMessage(domainSeparator, receipt, privateKeyB);

    await resolveSignedTransfer(transfer, signature);

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

    await sendSignedTransfer(transfer);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    const signature = await signReceiptMessage(domainSeparator, receipt, privateKeyB);

    await resolveSignedTransfer(transfer, signature);

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

  it("gets a pending signed transfer by lock hash", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId: receipt.paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract: domainSeparator.verifyingContract,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.SignedTransfer);

    const retrievedTransfer = await clientB.getSignedTransfer(receipt.paymentId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      paymentId: receipt.paymentId,
      senderIdentifier: clientA.publicIdentifier,
      status: SignedTransferStatus.PENDING,
      meta: {
        foo: "bar",
        sender: clientA.publicIdentifier,
        paymentId: receipt.paymentId,
        senderAssetId: transfer.assetId,
      },
    } as NodeResponses.GetSignedTransfer);
  });

  it("gets a completed signed transfer by lock hash", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      paymentId: receipt.paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract: domainSeparator.verifyingContract,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.SignedTransfer);
    // disconnect so that it cant be unlocked
    await clientA.off();

    const signature = await signReceiptMessage(domainSeparator, receipt, privateKeyB);

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      clientB.once(
        EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
        resolve,
        (data) => !!data.paymentId && data.paymentId === receipt.paymentId,
      );
      clientB.once(
        EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT,
        reject,
        (data) => !!data.paymentId && data.paymentId === receipt.paymentId,
      );
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: receipt.paymentId,
        data: receipt.data,
        signature,
      });
    });
    const retrievedTransfer = await clientB.getSignedTransfer(receipt.paymentId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      paymentId: receipt.paymentId,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: SignedTransferStatus.COMPLETED,
      meta: {
        foo: "bar",
        sender: clientA.publicIdentifier,
        paymentId: receipt.paymentId,
        senderAssetId: transfer.assetId,
      },
    } as NodeResponses.GetSignedTransfer);
  });

  it("cannot resolve a signed transfer if signature is wrong", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    await sendSignedTransfer(transfer);

    const badSig = hexlify(randomBytes(65));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: receipt.paymentId,
        data: receipt.data,
        signature: badSig,
      } as PublicParams.ResolveSignedTransfer),
    ).to.eventually.be.rejectedWith(/invalid signature|Incorrect signer/);
  });

  it("if sender uninstalls, node should force uninstall receiver first", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const [senderAppId, receiverAppId] = await sendSignedTransfer(transfer);

    clientA.uninstallApp(senderAppId);
    const winner = await Promise.race([
      new Promise<EventPayloads.Uninstall>((res) => {
        clientA.once(
          EventNames.UNINSTALL_EVENT,
          res,
          (data) => data.appIdentityHash === senderAppId,
        );
      }),
      new Promise<EventPayloads.Uninstall>((res) => {
        clientB.once(EventNames.UNINSTALL_EVENT, res);
      }),
    ]);
    expect(winner.appIdentityHash).to.be.eq(receiverAppId);
  });

  it("sender cannot uninstall before receiver", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const [senderAppId] = await sendSignedTransfer(transfer);

    // disconnect so receiver cannot uninstall
    await clientB.off();
    await clientB.off();

    await expect(clientA.uninstallApp(senderAppId)).to.eventually.be.rejected;
  });

  it("sender cannot uninstall unfinalized app when receiver is finalized", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);

    const signature = await signReceiptMessage(domainSeparator, receipt, privateKeyB);

    const [senderAppId] = await sendSignedTransfer(transfer);

    // disconnect so sender cannot unlock
    await clientA.off();

    await Promise.all([
      new Promise((res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.SignedTransfer,
        paymentId: receipt.paymentId,
        data: receipt.data,
        signature,
      } as PublicParams.ResolveSignedTransfer),
    ]);

    clientA.messaging.connect();
    await expect(clientA.uninstallApp(senderAppId)).to.eventually.be.rejected;
  });
});
