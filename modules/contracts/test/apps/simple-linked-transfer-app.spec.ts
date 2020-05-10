/* global before */
import { SolidityValueType } from "@connext/types";
import { Contract, ContractFactory } from "ethers";
import { AddressZero, Zero, One } from "ethers/constants";
import { BigNumber, defaultAbiCoder, solidityKeccak256 } from "ethers/utils";

import SimpleLinkedTransferApp from "../../build/SimpleLinkedTransferApp.json";

import { expect, provider } from "../utils";

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type SimpleLinkedTransferAppState = {
  coinTransfers: CoinTransfer[];
  linkedHash: string;
  amount: BigNumber;
  assetId: string;
  paymentId: string;
  preImage: string;
};

type SimpleLinkedTransferAppAction = {
  preImage: string;
};

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const linkedTransferAppStateEncoding = `tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  bytes32 linkedHash,
  uint256 amount,
  address assetId,
  bytes32 paymentId,
  bytes32 preImage
)`;

const linkedTransferAppActionEncoding = `
  tuple(
    bytes32 preImage
  )
`;

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): SimpleLinkedTransferAppState =>
  defaultAbiCoder.decode([linkedTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: SimpleLinkedTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([linkedTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: SolidityValueType): string {
  return defaultAbiCoder.encode([linkedTransferAppActionEncoding], [state]);
}

function createLinkedHash(
  amount: BigNumber,
  assetId: string,
  paymentId: string,
  preImage: string,
): string {
  return solidityKeccak256(
    ["uint256", "address", "bytes32", "bytes32"],
    [amount, assetId, paymentId, preImage],
  );
}

describe("SimpleLinkedTransferApp", () => {
  let simpleLinkedTransferApp: Contract;

  async function computeOutcome(state: SimpleLinkedTransferAppState): Promise<string> {
    return simpleLinkedTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return simpleLinkedTransferApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  async function init(state: SimpleLinkedTransferAppState): Promise<string> {
    return await simpleLinkedTransferApp.functions.init(encodeAppState(state));
  }

  async function generateInitialState(
    preImage: string = mkHash("0xb")
  ) {
    const senderAddr = mkAddress("0xa");
    const receiverAddr = mkAddress("0xB");
    const transferAmount = new BigNumber(10000);
    const paymentId = mkHash("0xa");
    const assetId = AddressZero;

    const linkedHash = createLinkedHash(transferAmount, assetId, paymentId, preImage);

    const preState: SimpleLinkedTransferAppState = {
      amount: transferAmount,
      assetId,
      coinTransfers: [
        {
          amount: transferAmount,
          to: senderAddr,
        },
        {
          amount: Zero,
          to: receiverAddr,
        },
      ],
      linkedHash,
      paymentId,
      preImage: mkHash("0x0"),
    };
    return preState;
  }

  beforeEach(async () => {
    const wallet = (await provider.getWallets())[0];
    simpleLinkedTransferApp = await new ContractFactory(
      SimpleLinkedTransferApp.abi,
      SimpleLinkedTransferApp.bytecode,
      wallet,
    ).deploy();
  });

  it("will pass init with correct state", async() => {
    let preState = await generateInitialState();
    const ret = await init(preState)
    expect(ret).to.be.ok
  })

  it("will fail init with zero initiator balance", async() => {
    let preState = await generateInitialState();
    preState.coinTransfers[0].amount = Zero;
    await expect(init(preState)).to.be.revertedWith("cannot install linked transfer with 0 initiator balance")
  })

  it("will fail init with nonzero responder balance", async() => {
    let preState = await generateInitialState();
    preState.coinTransfers[1].amount = One;
    await expect(init(preState)).to.be.revertedWith("cannot install linked transfer with nonzero responder balance")
  })

  it("will fail init with amount not equal to initiator balance", async() => {
    let preState = await generateInitialState();
    preState.amount = One;
    await expect(init(preState)).to.be.revertedWith("cannot install linked transfer with different amounts")
  })

  it("will fail init with populated preimage", async() => {
    let preState = await generateInitialState();
    preState.preImage = mkHash("0x1");
    await expect(init(preState)).to.be.revertedWith("cannot install a linked transfer with populated preimage")
  })

  it("will fail init with unpopulated paymentId", async() => {
    let preState = await generateInitialState();
    preState.paymentId = mkHash("0x0");
    await expect(init(preState)).to.be.revertedWith("cannot install a linked transfer with unpopulated paymentId")
  })

  it("will fail init with unpopulated linkedHash", async() => {
    let preState = await generateInitialState();
    preState.linkedHash = mkHash("0x0");
    await expect(init(preState)).to.be.revertedWith("cannot install a linked transfer with unpopulated linkedHash")
  })

  it("can redeem a payment with correct hash", async () => {
    const preImage: string = mkHash("0xb")
    const preState = await generateInitialState(preImage);

    const action: SimpleLinkedTransferAppAction = {
      preImage,
    };

    let ret = await applyAction(preState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.preImage).eq(preImage);

    const postState: SimpleLinkedTransferAppState = {
      ...preState,
      coinTransfers: [
        {
          ...preState.coinTransfers[0],
          amount: Zero
        },
        {
          ...preState.coinTransfers[1],
          amount: preState.coinTransfers[0].amount
        }
      ],
      preImage,
    };

    ret = await computeOutcome(afterActionState);
    const decoded = decodeTransfers(ret);

    expect(ret).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  });
});
