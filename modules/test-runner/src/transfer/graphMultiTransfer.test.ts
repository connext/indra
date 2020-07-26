import { PrivateKey, Address } from "@connext/types/dist/src/basic";
import {
  IConnextClient,
  GraphReceipt,
  EventNames,
  ConditionalTransferTypes,
  PublicParams,
  EventPayloads,
} from "@connext/types";
import { providers, constants, utils } from "ethers";
import {
  ethProviderUrl,
  createClient,
  AssetOptions,
  ETH_AMOUNT_SM,
  fundChannel,
  expect,
} from "../util";
import {
  getChainId,
  getRandomPrivateKey,
  getTestGraphReceiptToSign,
  getTestVerifyingContract,
  signGraphReceiptMessage,
  stringify
} from "@connext/utils";

const { AddressZero } = constants;
const { hexlify, randomBytes } = utils;

describe.only("GraphMultiTransfer", async () => {
  let privateKeyA: PrivateKey;
  let clientA: IConnextClient;
  let privateKeyB: PrivateKey;
  let clientB: IConnextClient;
  let tokenAddress: Address;
  let receipt: GraphReceipt;
  let chainId: number;
  let verifyingContract: Address;
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
    receipt = getTestGraphReceiptToSign();
    chainId = (await clientA.ethProvider.getNetwork()).chainId;
    verifyingContract = getTestVerifyingContract();
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it.only("Happy case: it can create and resolve the multitransfer app without making any transfers", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = hexlify(randomBytes(32));
    const transferPromise = clientB.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);

    await clientA.conditionalTransfer({
      amount: transfer.amount,
      conditionType: ConditionalTransferTypes.GraphMultiTransfer,
      paymentId,
      signerAddress: clientB.signerAddress,
      chainId,
      verifyingContract,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      assetId: transfer.assetId,
      recipient: clientB.publicIdentifier,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
    } as PublicParams.GraphMultiTransfer);
    const installed = await transferPromise;

    expect(installed).to.containSubset({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.GraphMultiTransfer,
      paymentId,
      sender: clientA.publicIdentifier,
      transferMeta: {
        signerAddress: clientB.signerAddress,
        chainId,
        verifyingContract,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
      },
      meta: {
        foo: "bar",
        recipient: clientB.publicIdentifier,
        sender: clientA.publicIdentifier,
        paymentId,
      },
    } as EventPayloads.GraphMultiTransferCreated);

    const {
      [clientA.signerAddress]: clientAPostInstallBal,
      [clientA.nodeSignerAddress]: nodeAPostInstallBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostInstallBal).to.eq(0);

    const unlockedPromise = clientA.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 10_000);
    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.GraphMultiTransfer,
      paymentId,
    } as PublicParams.ResolveGraphMultiTransfer);

    const eventData = await unlockedPromise;

    expect(eventData).to.deep.contain({
      amount: transfer.amount,
      assetId: transfer.assetId,
      type: ConditionalTransferTypes.GraphMultiTransfer,
      paymentId,
      sender: clientA.publicIdentifier,
      transferMeta: {},
      meta: {
        foo: "bar",
        recipient: clientB.publicIdentifier,
        sender: clientA.publicIdentifier,
        paymentId,
      },
    } as EventPayloads.GraphMultiTransferUnlocked);
  });
});
