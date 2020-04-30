import {
  CoinTransfer,
  HashLockTransferAppAction,
  HashLockTransferAppActionEncoding,
  HashLockTransferAppState,
  HashLockTransferAppStateEncoding,
  singleAssetTwoPartyCoinTransferEncoding,
  SolidityValueType,
} from "@connext/types";
import { Wallet, Contract, ContractFactory, BigNumber, utils, constants } from "ethers";

import LightningHTLCTransferApp from "../../build/HashLockTransferApp.json";

import { expect, provider } from "../utils";

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  utils.defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): HashLockTransferAppState =>
  utils.defaultAbiCoder.decode([HashLockTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: HashLockTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return utils.defaultAbiCoder.encode([HashLockTransferAppStateEncoding], [state]);
  return utils.defaultAbiCoder.encode(
    [singleAssetTwoPartyCoinTransferEncoding],
    [state.coinTransfers],
  );
};

function encodeAppAction(state: SolidityValueType): string {
  return utils.defaultAbiCoder.encode([HashLockTransferAppActionEncoding], [state]);
}

function createLockHash(preImage: string): string {
  return utils.soliditySha256(["bytes32"], [preImage]);
}

describe("LightningHTLCTransferApp", () => {
  let lightningHTLCTransferApp: Contract;
  let senderAddr: string;
  let receiverAddr: string;
  let transferAmount: BigNumber;
  let preImage: string;
  let lockHash: string;
  let expiry: BigNumber;
  let preState: HashLockTransferAppState;

  async function computeOutcome(state: HashLockTransferAppState): Promise<string> {
    return lightningHTLCTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return lightningHTLCTransferApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  async function validateOutcome(encodedTransfers: string, postState: HashLockTransferAppState) {
    const decoded = decodeTransfers(encodedTransfers);
    expect(encodedTransfers).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  }

  beforeEach(async () => {
    const wallet = new Wallet((await provider.getWallets())[0].privateKey);
    lightningHTLCTransferApp = await new ContractFactory(
      LightningHTLCTransferApp.abi,
      LightningHTLCTransferApp.bytecode,
      wallet,
    ).deploy();

    senderAddr = mkAddress("0xa");
    receiverAddr = mkAddress("0xB");
    transferAmount = BigNumber.from(10000);
    preImage = mkHash("0xb");
    lockHash = createLockHash(preImage);
    expiry = BigNumber.from(await provider.getBlockNumber()).add(100);
    preState = {
      coinTransfers: [
        {
          amount: transferAmount,
          to: senderAddr,
        },
        {
          amount: constants.Zero,
          to: receiverAddr,
        },
      ],
      lockHash,
      expiry,
      preImage: mkHash("0x0"),
      finalized: false,
    };
  });

  describe("update state", () => {
    it("will redeem a payment with correct hash within expiry", async () => {
      const action: HashLockTransferAppAction = {
        preImage,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: HashLockTransferAppState = {
        coinTransfers: [
          {
            amount: constants.Zero,
            to: senderAddr,
          },
          {
            amount: transferAmount,
            to: receiverAddr,
          },
        ],
        lockHash,
        preImage,
        expiry,
        finalized: true,
      };

      expect(afterActionState.finalized).to.eq(expectedPostState.finalized);
      expect(afterActionState.coinTransfers[0].amount).to.eq(
        expectedPostState.coinTransfers[0].amount,
      );
      expect(afterActionState.coinTransfers[1].amount).to.eq(
        expectedPostState.coinTransfers[1].amount,
      );

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, expectedPostState);
    });

    it("will revert action with incorrect hash", async () => {
      const action: HashLockTransferAppAction = {
        preImage: mkHash("0xc"), // incorrect hash
      };

      await expect(applyAction(preState, action)).revertedWith(
        "Hash generated from preimage does not match hash in state",
      );
    });

    it("will revert action if already finalized", async () => {
      const action: HashLockTransferAppAction = {
        preImage,
      };
      preState.finalized = true;

      await expect(applyAction(preState, action)).revertedWith(
        "Cannot take action on finalized state",
      );
    });

    it("will revert action if timeout has expired", async () => {
      const action: HashLockTransferAppAction = {
        preImage,
      };
      preState.expiry = BigNumber.from(await provider.getBlockNumber());

      await expect(applyAction(preState, action)).revertedWith(
        "Cannot take action if expiry is expired",
      );
    });

    it("will revert outcome that is not finalized with unexpired expiry", async () => {
      await expect(computeOutcome(preState)).revertedWith(
        "Cannot revert payment if expiry is unexpired",
      );
    });

    it("will refund payment that is not finalized with expired expiry", async () => {
      preState.expiry = BigNumber.from(await provider.getBlockNumber());
      let ret = await computeOutcome(preState);

      validateOutcome(ret, preState);
    });
  });
});
