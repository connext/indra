/* global before */
import { SolidityValueType } from "@connext/types";
import { Contract, ContractFactory, Wallet, ethers } from "ethers";
import { AddressZero, Zero, One } from "ethers/constants";
import { BigNumber, defaultAbiCoder, solidityKeccak256, AbiCoder } from "ethers/utils";

import SimpleSignedTransferApp from "../../build/SimpleSignedTransferApp.json";

import { expect, provider } from "../utils";
import { ChannelSigner } from "@connext/utils";

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type SimpleSignedTransferAppState = {
  coinTransfers: CoinTransfer[];
  signer: string;
  paymentId: string;
  finalized: boolean;
};

type SimpleSignedTransferAppAction = {
  data: string;
  signature: string;
};

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const signedTransferAppStateEncoding = `tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  address signer,
  bytes32 paymentId,
  bool finalized
)`;

const signedTransferAppActionEncoding = `
  tuple(
    bytes32 data,
    bytes signature
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

const decodeAppState = (encodedAppState: string): SimpleSignedTransferAppState =>
  defaultAbiCoder.decode([signedTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: SimpleSignedTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([signedTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(action: SimpleSignedTransferAppAction): string {
  return defaultAbiCoder.encode([signedTransferAppActionEncoding], [action]);
}

describe("SimpleSignedTransferApp", () => {
  let simpleSignedTransferApp: Contract;
  let wallet: Wallet;

  async function computeOutcome(state: SimpleSignedTransferAppState): Promise<string> {
    return simpleSignedTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: SimpleSignedTransferAppState, action: SimpleSignedTransferAppAction): Promise<string> {
    return simpleSignedTransferApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  async function init(state: SimpleSignedTransferAppState): Promise<string> {
    return await simpleSignedTransferApp.functions.init(encodeAppState(state));
  }

  async function generateInitialState() {
    const senderAddr = mkAddress("0xa");
    const receiverAddr = mkAddress("0xB");
    const transferAmount = new BigNumber(10000);
    const paymentId = mkHash("0xa");

    const preState: SimpleSignedTransferAppState = {
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
      signer: wallet.address,
      paymentId,
      finalized: false,
    };
    return preState;
  }

  beforeEach(async () => {
    wallet = (await provider.getWallets())[0];
    simpleSignedTransferApp = await new ContractFactory(
      SimpleSignedTransferApp.abi,
      SimpleSignedTransferApp.bytecode,
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
    await expect(init(preState)).to.be.revertedWith("cannot install signed transfer with 0 initiator balance")
  })

  it("will fail init with nonzero responder balance", async() => {
    let preState = await generateInitialState();
    preState.coinTransfers[1].amount = One;
    await expect(init(preState)).to.be.revertedWith("cannot install signed transfer with nonzero responder balance")
  })

  it("will fail init with unpopulated signer", async() => {
    let preState = await generateInitialState();
    preState.signer = mkAddress("0x0");
    await expect(init(preState)).to.be.revertedWith("cannot install a signed transfer with unpopulated signer")
  })

  it("will fail init with unpopulated paymentId", async() => {
    let preState = await generateInitialState();
    preState.paymentId = mkHash("0x0");
    await expect(init(preState)).to.be.revertedWith("cannot install a signed transfer with unpopulated paymentId")
  })

  it("can unlock a payment with correct signature", async () => {
    const preState = await generateInitialState();
    const data = mkHash("0x1")
    const rawHash = solidityKeccak256(["bytes32", "bytes32"], [data, preState.paymentId])
    const signer = new ChannelSigner(wallet.privateKey)
    const signature = await signer.signMessage(rawHash)

    const action: SimpleSignedTransferAppAction = {
      data,
      signature,
    };

    let ret = await applyAction(preState, action);
    const afterActionState = decodeAppState(ret);
    expect(afterActionState.finalized).to.be.true;

    const postState: SimpleSignedTransferAppState = {
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
      finalized: true,
    };

    ret = await computeOutcome(afterActionState);
    const decoded = decodeTransfers(ret);

    expect(ret).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  });

  it("cannot unlock a payment with finalized state", async () => {
      let preState = await generateInitialState();
      const data = mkHash("0x1")
      const rawHash = solidityKeccak256(["bytes32", "bytes32"], [data, preState.paymentId])
      const signer = new ChannelSigner(wallet.privateKey)
      const signature = await signer.signMessage(rawHash)

      const action: SimpleSignedTransferAppAction = {
        data,
        signature,
      };

      preState.finalized = true;
      await expect(applyAction(preState, action)).revertedWith("Cannot take action on finalized state")
  })

  it("cannot unlock a payment with incorrect signer on signature", async () => {
    let preState = await generateInitialState();
    const data = mkHash("0x1")
    const rawHash = solidityKeccak256(["bytes32", "bytes32"], [data, preState.paymentId])
    // wrong signer
    const wallet = Wallet.createRandom();
    const signer = new ChannelSigner(wallet.privateKey)
    const signature = await signer.signMessage(rawHash)

    const action: SimpleSignedTransferAppAction = {
      data,
      signature,
    };

    await expect(applyAction(preState, action)).revertedWith("Incorrect signer recovered from signature")
})
});
