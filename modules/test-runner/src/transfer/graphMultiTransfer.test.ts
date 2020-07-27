import { PrivateKey, Address } from "@connext/types/dist/src/basic";
import {
  IConnextClient,
  GraphReceipt,
  EventNames,
  ConditionalTransferTypes,
  PublicParams,
  EventPayloads,
  GraphActionType,
  GraphMultiTransferAppState,
} from "@connext/types";
import { providers, constants, utils, BigNumber } from "ethers";
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
  stringify,
} from "@connext/utils";
import { hexZeroPad } from "ethers/lib/utils";
const { zeroPad } = utils;
const { HashZero, Zero } = constants;

const { AddressZero } = constants;
const { hexlify, randomBytes } = utils;
const emptySignature = hexZeroPad(hexlify(0), 65);

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
  const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };

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

  const createGraphMultiTransfer = async (): Promise<string> => {
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

    return paymentId;
  };

  const resolveGraphMultiTransfer = async (paymentId: string): Promise<void> => {
    const unlockedPromise = clientA.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 10_000);
    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.GraphMultiTransfer,
      paymentId,
    } as PublicParams.ResolveGraphMultiTransfer);

    const eventData = await unlockedPromise;
    expect(eventData).to.containSubset({
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
  };

  const createAppTransfer = async (paymentId: string, price: BigNumber): Promise<void> => {
    const createUpdatePromise = clientB.waitFor(
      EventNames.CONDITIONAL_TRANSFER_UPDATED_EVENT,
      10_000,
    );

    await clientA.updateConditionalTransfer({
      conditionType: ConditionalTransferTypes.GraphMultiTransfer,
      actionType: GraphActionType.CREATE,
      paymentId,
      price,
      requestCID: receipt.requestCID,
    } as PublicParams.UpdateConditionalTransfer);

    const createUpdated = await createUpdatePromise;

    expect(createUpdated).to.containSubset({
      type: ConditionalTransferTypes.GraphMultiTransfer,
      paymentId,
      newState: {
        coinTransfers: [
          {
            amount: BigNumber.from(transfer.amount),
            to: clientB.nodeSignerAddress,
          },
          {
            amount: Zero,
            to: clientB.signerAddress,
          },
        ],
        lockedPayment: {
          price: transfer.amount.div(100),
          requestCID: receipt.requestCID,
        },
        chainId: BigNumber.from(chainId),
        signerAddress: clientB.signerAddress,
        verifyingContract,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        finalized: false,
        turnNum: BigNumber.from(1),
      },
      action: {
        actionType: GraphActionType.CREATE,
        price: transfer.amount.div(100),
        requestCID: receipt.requestCID,
        responseCID: HashZero,
        signature: emptySignature,
      },
    } as EventPayloads.GraphMultiTransferUpdated);
  };

  const unlockAppTransfer = async (paymentId: string): Promise<void> => {
    const unlockUpdatePromise = clientA.waitFor(
      EventNames.CONDITIONAL_TRANSFER_UPDATED_EVENT,
      10_000,
    );

    const signature = await signGraphReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      privateKeyB,
    );
    await clientB.updateConditionalTransfer({
      conditionType: ConditionalTransferTypes.GraphMultiTransfer,
      actionType: GraphActionType.UNLOCK,
      paymentId,
      responseCID: receipt.responseCID,
      signature,
    } as PublicParams.UpdateConditionalTransfer);

    const unlockUpdated = await unlockUpdatePromise;

    expect(unlockUpdated).to.containSubset({
      type: ConditionalTransferTypes.GraphMultiTransfer,
      paymentId,
      newState: {
        coinTransfers: [
          {
            amount: BigNumber.from(transfer.amount).sub(transfer.amount.div(100)),
            to: clientA.signerAddress,
          },
          {
            amount: transfer.amount.div(100),
            to: clientA.nodeSignerAddress,
          },
        ],
        lockedPayment: {
          price: Zero,
          requestCID: HashZero,
        },
        chainId: BigNumber.from(chainId),
        signerAddress: clientB.signerAddress,
        verifyingContract,
        subgraphDeploymentID: receipt.subgraphDeploymentID,
        finalized: false,
        turnNum: BigNumber.from(2),
      },
      action: {
        actionType: GraphActionType.UNLOCK,
        price: Zero,
        requestCID: HashZero,
        responseCID: receipt.responseCID,
        signature,
      },
    } as EventPayloads.GraphMultiTransferUpdated);
  };

  it("Happy case: it can create and resolve the multitransfer app without making any transfers", async () => {
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = await createGraphMultiTransfer();
    await resolveGraphMultiTransfer(paymentId);

    const {
      [clientA.signerAddress]: clientAPostUninstallBal,
      [clientA.nodeSignerAddress]: nodeAPostUninstallBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostUninstallBal.eq(transfer.amount)).to.be.true;
  });

  it.only("Happy case: it can create, make a transfer, and resolve the multitransfer app", async () => {
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const paymentId = await createGraphMultiTransfer();
    const price = transfer.amount.div(100)
    await createAppTransfer(paymentId, price);
    await unlockAppTransfer(paymentId);
    await resolveGraphMultiTransfer(paymentId);

    const {
        [clientA.signerAddress]: clientAPostUninstallBal,
        [clientA.nodeSignerAddress]: nodeAPostUninstallBal,
      } = await clientA.getFreeBalance(transfer.assetId);
    const {
    [clientB.signerAddress]: clientBPostUninstallBal,
    [clientB.nodeSignerAddress]: nodeBPostUninstallBal,
    } = await clientB.getFreeBalance(transfer.assetId);
    expect(clientAPostUninstallBal.eq(transfer.amount.sub(transfer.amount.div(100)))).to.be.true;
    expect(clientBPostUninstallBal.eq(transfer.amount.div(100))).to.be.true;
  });
});
