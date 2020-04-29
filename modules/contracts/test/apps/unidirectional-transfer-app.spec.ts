/* global before */
import { SolidityValueType } from "@connext/types";
import {
  Wallet,
  Contract,
  ContractFactory,
  BigNumber,
  BigNumberish,
  constants,
  utils,
} from "ethers";

import UnidirectionalTransferApp from "../../build/UnidirectionalTransferApp.json";

import { expect, provider } from "../utils";

type CoinTransfer = {
  to: string;
  amount: BigNumberish;
};

enum AppStage {
  POST_FUND,
  MONEY_SENT,
  CHANNEL_CLOSED,
}

type UnidirectionalTransferAppState = {
  stage: AppStage;
  transfers: CoinTransfer[];
  turnNum: BigNumberish;
  finalized: boolean;
};

enum ActionType {
  SEND_MONEY,
  END_CHANNEL,
}

type UnidirectionalTransferAppAction = {
  actionType: ActionType;
  amount: BigNumberish;
};

function mkAddress(prefix: string = "0xa"): string {
  return utils.getAddress(prefix.padEnd(42, "0"));
}

const singleAssetTwoPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const unidirectionalTransferAppStateEncoding = `
  tuple(
    uint8 stage,
    ${singleAssetTwoPartyCoinTransferEncoding} transfers,
    uint256 turnNum,
    bool finalized
  )`;

const unidirectionalTransferAppActionEncoding = `
  tuple(
    uint8 actionType,
    uint256 amount
  )`;

const decodeAppState = (encodedAppState: string): UnidirectionalTransferAppState =>
  utils.defaultAbiCoder.decode([unidirectionalTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (state: SolidityValueType) =>
  utils.defaultAbiCoder.encode([unidirectionalTransferAppStateEncoding], [state]);

const encodeAppAction = (state: SolidityValueType) =>
  utils.defaultAbiCoder.encode([unidirectionalTransferAppActionEncoding], [state]);

describe("UnidirectionalTransferApp", () => {
  let unidirectionalTransferApp: Contract;

  const applyAction = (state: SolidityValueType, action: SolidityValueType) =>
    unidirectionalTransferApp.functions.applyAction(encodeAppState(state), encodeAppAction(action));

  const computeOutcome = (state: SolidityValueType) =>
    unidirectionalTransferApp.functions.computeOutcome(encodeAppState(state));

  before(async () => {
    const wallet = new Wallet((await provider.getWallets())[0].privateKey);
    unidirectionalTransferApp = await new ContractFactory(
      UnidirectionalTransferApp.abi as any,
      UnidirectionalTransferApp.bytecode,
      wallet,
    ).deploy();
  });

  describe("The applyAction function", () => {
    const initialState: UnidirectionalTransferAppState = {
      stage: AppStage.POST_FUND,
      transfers: [
        { to: mkAddress("0xa"), amount: constants.One.mul(2) },
        { to: mkAddress("0xb"), amount: constants.Zero },
      ],
      turnNum: 0,
      finalized: false,
    };

    describe("A valid SEND_MONEY action", () => {
      let newState: UnidirectionalTransferAppState;

      before(async () => {
        const action: UnidirectionalTransferAppAction = {
          amount: constants.One,
          actionType: ActionType.SEND_MONEY,
        };

        newState = decodeAppState(await applyAction(initialState, action));
      });

      it("decrements the balance of the sender", async () => {
        const {
          transfers: [{ amount }],
        } = newState;
        expect(amount).to.eq(constants.One);
      });

      it("increments the balance of the recipient", async () => {
        const {
          transfers: [{}, { amount }],
        } = newState;
        expect(amount).to.eq(constants.One);
      });

      it("does not change the addresses of the participants", async () => {
        const {
          transfers: [{ to: to1 }, { to: to2 }],
        } = newState;
        expect(to1).to.eq(initialState.transfers[0].to);
        expect(to2).to.eq(initialState.transfers[1].to);
      });
    });

    it("reverts if the amount is larger than the sender's balance", async () => {
      const action: UnidirectionalTransferAppAction = {
        amount: constants.One.mul(3),
        actionType: ActionType.SEND_MONEY,
      };

      await expect(applyAction(initialState, action)).to.revertedWith(
        "SafeMath: subtraction overflow",
      );
    });

    it("reverts if given an invalid actionType", async () => {
      const action: UnidirectionalTransferAppAction = {
        amount: constants.One,
        actionType: 2,
      };

      await expect(applyAction(initialState, action)).to.reverted;
    });

    it("reverts if given a SEND_MONEY action from CHANNEL_CLOSED state", async () => {
      const action: UnidirectionalTransferAppAction = {
        amount: constants.One.mul(3),
        actionType: ActionType.SEND_MONEY,
      };

      await expect(applyAction({ ...initialState, stage: 2 }, action)).to.revertedWith(
        // TODO: Note this error kind of makes no sense if you read it
        "Invalid action. Valid actions from MONEY_SENT are {END_CHANNEL}",
      );
    });

    it("can finalize the state by calling END_CHANNEL", async () => {
      const senderAddr = mkAddress("0xa");
      const receiverAddr = mkAddress("0xb");

      const senderAmt = BigNumber.from(10000);

      const preState: UnidirectionalTransferAppState = {
        stage: AppStage.POST_FUND,
        transfers: [
          { to: senderAddr, amount: senderAmt },
          { to: receiverAddr, amount: constants.Zero },
        ],
        turnNum: 0,
        finalized: false,
      };

      const action: UnidirectionalTransferAppAction = {
        actionType: ActionType.END_CHANNEL,
        amount: constants.Zero,
      };

      let ret = await applyAction(preState, action);

      const state = decodeAppState(ret);

      expect(state.finalized).to.be.true;

      ret = await computeOutcome(state);

      expect(ret).to.eq(
        utils.defaultAbiCoder.encode(
          [singleAssetTwoPartyCoinTransferEncoding],
          [
            [
              [senderAddr, senderAmt],
              [receiverAddr, constants.Zero],
            ],
          ],
        ),
      );
    });
  });
});
