/* global before */
import { Contract, ContractFactory } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber, BigNumberish, defaultAbiCoder } from "ethers/utils";

import UnidirectionalTransferApp from "../../build/UnidirectionalTransferApp.json";

import { expect, provider } from "../utils";

type CoinTransfer = {
  to: string;
  amount: BigNumber;
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
  amount: BigNumber;
};

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
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
  defaultAbiCoder.decode([unidirectionalTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (state: any): string =>
  defaultAbiCoder.encode([unidirectionalTransferAppStateEncoding], [state]);

const encodeAppAction = (state: any): string =>
  defaultAbiCoder.encode([unidirectionalTransferAppActionEncoding], [state]);

describe("UnidirectionalTransferApp", () => {
  let unidirectionalTransferApp: Contract;

  const applyAction = (state: any, action: any): any =>
    unidirectionalTransferApp.functions.applyAction(encodeAppState(state), encodeAppAction(action));

  const computeOutcome = (state: any): any =>
    unidirectionalTransferApp.functions.computeOutcome(encodeAppState(state));

  before(async () => {
    const wallet = (await provider.getWallets())[0];
    unidirectionalTransferApp = await new ContractFactory(
      UnidirectionalTransferApp.abi,
      UnidirectionalTransferApp.bytecode,
      wallet,
    ).deploy();
  });

  it("can make transfers", async () => {
    const senderAddr = mkAddress("0xa");
    const receiverAddr = mkAddress("0xb");

    const senderAmt = new BigNumber(10000);
    const amount = new BigNumber(10);

    const preState: UnidirectionalTransferAppState = {
      finalized: false,
      stage: AppStage.POST_FUND,
      transfers: [
        { to: senderAddr, amount: senderAmt },
        { to: receiverAddr, amount: Zero },
      ],
      turnNum: 0,
    };

    const action: UnidirectionalTransferAppAction = {
      actionType: ActionType.SEND_MONEY,
      amount,
    };

    const ret = await applyAction(preState, action);

    const state = decodeAppState(ret);

    expect(state.transfers[0].amount).to.eq(senderAmt.sub(amount));
    expect(state.transfers[1].amount).to.eq(amount);
  });

  it("can finalize the state by calling END_CHANNEL", async () => {
    const senderAddr = mkAddress("0xa");
    const receiverAddr = mkAddress("0xb");

    const senderAmt = new BigNumber(10000);

    const preState: UnidirectionalTransferAppState = {
      finalized: false,
      stage: AppStage.POST_FUND,
      transfers: [
        { to: senderAddr, amount: senderAmt },
        { to: receiverAddr, amount: Zero },
      ],
      turnNum: 0,
    };

    const action: UnidirectionalTransferAppAction = {
      actionType: ActionType.END_CHANNEL,
      amount: Zero,
    };

    let ret = await applyAction(preState, action);

    const state = decodeAppState(ret);

    expect(state.finalized).to.be.true;

    ret = await computeOutcome(state);

    expect(ret).to.eq(
      defaultAbiCoder.encode(
        [singleAssetTwoPartyCoinTransferEncoding],
        [
          [
            [senderAddr, senderAmt],
            [receiverAddr, Zero],
          ],
        ],
      ),
    );
  });
});
