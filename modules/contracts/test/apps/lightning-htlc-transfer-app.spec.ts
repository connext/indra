import {
  CoinTransfer,
  HashLockTransferAppAction,
  HashLockTransferAppActionEncoding,
  HashLockTransferAppState,
  HashLockTransferAppStateEncoding,
  singleAssetTwoPartyCoinTransferEncoding,
  SolidityValueType,
} from "@connext/types";
import { Contract, ContractFactory } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber, defaultAbiCoder, soliditySha256, bigNumberify } from "ethers/utils";

import LightningHTLCTransferApp from "../../build/HashLockTransferApp.json";

import { expect, provider } from "../utils";


function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): HashLockTransferAppState =>
  defaultAbiCoder.decode([HashLockTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: HashLockTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return defaultAbiCoder.encode([HashLockTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: SolidityValueType): string {
  return defaultAbiCoder.encode([HashLockTransferAppActionEncoding], [state]);
}

function createLockHash(preImage: string): string {
  return soliditySha256(["bytes32"], [preImage]);
}

describe("LightningHTLCTransferApp", () => {
  let lightningHTLCTransferApp: Contract;
  let senderAddr: string;
  let receiverAddr: string;
  let transferAmount: BigNumber;
  let preImage: string;
  let lockHash: string;
  let timelock: BigNumber;
  let preState: HashLockTransferAppState;

  async function computeOutcome(state: HashLockTransferAppState): Promise<string> {
    return await lightningHTLCTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return await lightningHTLCTransferApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  async function validateOutcome(
    encodedTransfers: string,
    postState: HashLockTransferAppState,
  ) {
    const decoded = decodeTransfers(encodedTransfers);
    expect(encodedTransfers).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  }

  beforeEach(async () => {
    const wallet = (await provider.getWallets())[0];
    lightningHTLCTransferApp = await new ContractFactory(
      LightningHTLCTransferApp.abi,
      LightningHTLCTransferApp.bytecode,
      wallet,
    ).deploy();

    senderAddr = mkAddress("0xa");
    receiverAddr = mkAddress("0xB");
    transferAmount = new BigNumber(10000);
    preImage = mkHash("0xb");
    lockHash = createLockHash(preImage);
    timelock = bigNumberify(await provider.getBlockNumber()).add(100);
    preState = {
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
      lockHash,
      timelock,
      preImage: mkHash("0x0"),
      finalized: false,
    };
  });

  describe("update state", () => {
    it("will redeem a payment with correct hash within timelock", async () => {
      const action: HashLockTransferAppAction = {
        preImage,
      };

      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: HashLockTransferAppState = {
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
        lockHash,
        preImage,
        timelock,
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
      preState.timelock = bigNumberify(await provider.getBlockNumber());

      await expect(applyAction(preState, action)).revertedWith(
        "Cannot take action if timelock is expired",
      );
    });

    it("will revert outcome that is not finalized with unexpired timelock", async () => {
      await expect(computeOutcome(preState)).revertedWith(
        "Cannot revert payment if timelock is unexpired",
      );
    });

    it("will refund payment that is not finalized with expired timelock", async () => {
      preState.timelock = bigNumberify(await provider.getBlockNumber());
      let ret = await computeOutcome(preState);

      validateOutcome(ret, preState);
    });
  });
});
