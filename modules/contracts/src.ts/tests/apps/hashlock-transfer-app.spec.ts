import { getRandomAddress, getRandomBytes32 } from "@connext/utils";
import {
  CoinTransfer,
  HashLockTransferAppAction,
  HashLockTransferAppActionEncoding,
  HashLockTransferAppState,
  HashLockTransferAppStateEncoding,
  singleAssetTwoPartyCoinTransferEncoding,
  SolidityValueType,
} from "@connext/types";
import { BigNumber, Contract, ContractFactory, constants, utils } from "ethers";

import { HashLockTransferApp } from "../../artifacts";

import { expect, provider } from "../utils";

const { Zero } = constants;
const { defaultAbiCoder, soliditySha256 } = utils;

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

const encodeAppAction = (state: SolidityValueType): string => {
  return defaultAbiCoder.encode([HashLockTransferAppActionEncoding], [state]);
};

const createLockHash = (preImage: string): string => {
  return soliditySha256(["bytes32"], [preImage]);
};

describe("HashLockTransferApp", () => {
  let hashLockTransferApp: Contract;
  let senderAddr: string;
  let receiverAddr: string;
  let transferAmount: BigNumber;
  let preImage: string;
  let lockHash: string;
  let expiry: BigNumber;
  let preState: HashLockTransferAppState;

  const computeOutcome = async (state: HashLockTransferAppState): Promise<string> => {
    return hashLockTransferApp.computeOutcome(encodeAppState(state));
  };

  const applyAction = async (state: any, action: SolidityValueType): Promise<string> => {
    return hashLockTransferApp.applyAction(encodeAppState(state), encodeAppAction(action));
  };

  const validateOutcome = async (encodedTransfers: string, postState: HashLockTransferAppState) => {
    const decoded = decodeTransfers(encodedTransfers);
    expect(encodedTransfers).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  };

  beforeEach(async () => {
    const wallet = (await provider.getWallets())[0];
    hashLockTransferApp = await new ContractFactory(
      HashLockTransferApp.abi,
      HashLockTransferApp.bytecode,
      wallet,
    ).deploy();

    senderAddr = getRandomAddress();
    receiverAddr = getRandomAddress();
    transferAmount = BigNumber.from(10000);
    preImage = getRandomBytes32();
    lockHash = createLockHash(preImage);
    expiry = BigNumber.from(await provider.getBlockNumber()).add(100);
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
      expiry,
      preImage: getRandomBytes32(),
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
        preImage: getRandomBytes32(), // incorrect hash
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
      const ret = await computeOutcome(preState);
      validateOutcome(ret, preState);
    });
  });
});
