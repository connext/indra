import { Address, SolidityValueType } from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import {
  BigNumber,
  defaultAbiCoder,
  solidityKeccak256,
  formatBytes32String,
  parseBytes32String,
  arrayify,
} from "ethers/utils";

import SimpleSignatureTransferApp from "../../build/SimpleSignatureTransferApp.json";

const privateKey = "0x3141592653589793238462643383279502884197169399375105820974944592";
const wallet = new Wallet(privateKey);
const { address } = wallet;
const dummyData = { big: "data" };

chai.use(waffle.solidity);

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type SimpleSignatureTransferAppState = {
  coinTransfers: CoinTransfer[];
  amount: BigNumber;
  assetId: string;
  data: string;
  paymentId: string;
  signature: string;
  signer: string;
};

type SimpleSignatureTransferAppAction = {
  data: string;
  signature: string;
};

const { expect } = chai;

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const signatureTransferAppStateEncoding = `tuple(
  ${singleAssetTwoPartyCoinTransferEncoding} coinTransfers,
  uint256 amount,
  address assetId,
  bytes32 paymentId,
  address signer,
  bytes32 data,
  bytes signature
)`;

const signatureTransferAppActionEncoding = `
  tuple(
    bytes32 data,
    bytes signature,
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

const decodeAppState = (encodedAppState: string): SimpleSignatureTransferAppState =>
  defaultAbiCoder.decode([signatureTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (state: SimpleSignatureTransferAppState, onlyCoinTransfers: boolean = false): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([signatureTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: SolidityValueType): string {
  return defaultAbiCoder.encode([signatureTransferAppActionEncoding], [state]);
}

async function createSignedData(amount: BigNumber, assetId: string, paymentId: string, data: string): Promise<string> {
  const msg = [
    { type: "uint256", value: amount },
    { type: "address", value: assetId },
    { type: "bytes32", value: paymentId },
    { type: "bytes32", value: data },
  ];

  const hash = solidityKeccak256(msg.map(d => d.type), msg.map(d => d.value));
  const signature = await wallet.signMessage(arrayify(hash));
  return signature;
}

describe("SimpleSignatureTransferApp", () => {
  let simpleSignatureTransferApp: Contract;

  async function computeOutcome(state: SimpleSignatureTransferAppState): Promise<string> {
    return await simpleSignatureTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return await simpleSignatureTransferApp.functions.applyAction(encodeAppState(state), encodeAppAction(action));
  }

  before(async () => {
    const provider = waffle.createMockProvider();
    const wallet = (await waffle.getWallets(provider))[0];
    simpleSignatureTransferApp = await waffle.deployContract(wallet, SimpleSignatureTransferApp);
  });

  describe("update state", () => {
    it("can redeem a payment with correct signature", async () => {
      const senderAddr = mkAddress("0xa");
      const receiverAddr = mkAddress("0xB");
      const transferAmount = new BigNumber(10000);
      const paymentId = mkHash("0xa");
      const assetId = AddressZero;
      const data = formatBytes32String(JSON.stringify(dummyData));
      const signer = address;

      const signature = await createSignedData(transferAmount, assetId, paymentId, data);

      const preState: SimpleSignatureTransferAppState = {
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
        data: mkHash("0x0"),
        paymentId,
        signature: mkHash("0x0"),
        signer,
      };

      const action: SimpleSignatureTransferAppAction = {
        data,
        signature,
      };

      let ret = await applyAction(preState, action);

      const afterActionState = decodeAppState(ret);
      expect(afterActionState.signature).eq(signature);
      expect(afterActionState.data).eq(data);

      const postState: SimpleSignatureTransferAppState = {
        amount: transferAmount,
        assetId,
        coinTransfers: [
          {
            amount: Zero,
            to: senderAddr,
          },
          {
            amount: transferAmount,
            to: receiverAddr,
          },
        ],
        data,
        paymentId,
        signature,
        signer,
      };

      ret = await computeOutcome(afterActionState);
      const decoded = decodeTransfers(ret);

      const recoveredData = JSON.parse(parseBytes32String(afterActionState.data));
      expect(recoveredData).to.eql(dummyData);
      expect(ret).to.eq(encodeAppState(postState, true));
      expect(decoded[0].to).eq(postState.coinTransfers[0].to);
      expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
      expect(decoded[1].to).eq(postState.coinTransfers[1].to);
      expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
    });
  });
});
