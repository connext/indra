import { expect, use } from "chai";
import { solidity, getWallets, deployContract } from "ethereum-waffle";
import { waffle } from "@nomiclabs/buidler";
import { Contract } from "ethers";
import { BigNumber, defaultAbiCoder, bigNumberify } from "ethers/utils";

import FastSignedTransferApp from "../../build/FastSignedTransferApp.json";

import { mkAddress, mkHash, mkXpub, mkSig } from "../utils";
import { Zero, One, AddressZero } from "ethers/constants";
import {
  FastSignerTransferAppActionEncoding,
  FastSignerTransferAppStateEncoding,
} from "@connext/types";

use(solidity);

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type Payment = {
  amount: BigNumber;
  assetId: string;
  signer: string;
  paymentId: string;
  timeout: BigNumber;
  recipientXpub: string;
  data: string;
  signature: string;
};

type FastGenericSignedTransferAppState = {
  lockedPayments: Payment[];
  coinTransfers: CoinTransfer[];
  finalized: boolean;
  turnNum: BigNumber;
};

enum ActionType {
  CREATE,
  UNLOCK,
  REJECT,
  FINALIZE,
}

type FastGenericSignedTransferAppAction = {
  newLockedPayments: Payment[];
  actionType: ActionType;
};

const decodeAppState = (encodedAppState: string): FastGenericSignedTransferAppState[] =>
  defaultAbiCoder.decode([FastSignerTransferAppStateEncoding], encodedAppState);

const encodeAppState = (state: FastGenericSignedTransferAppState): string => {
  return defaultAbiCoder.encode([FastSignerTransferAppStateEncoding], [state]);
};

const encodeAppAction = (action: FastGenericSignedTransferAppAction): string => {
  return defaultAbiCoder.encode([FastSignerTransferAppActionEncoding], [action]);
};

describe("FastGenericSignedTransferApp", () => {
  let transferApp: Contract;

  async function computeOutcome(state: FastGenericSignedTransferAppState): Promise<string> {
    return await transferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function takeAction(
    state: FastGenericSignedTransferAppState,
    action: FastGenericSignedTransferAppAction,
  ): Promise<string> {
    return await transferApp.functions.applyAction(encodeAppState(state), encodeAppAction(action));
  }

  beforeEach(async () => {
    const provider = waffle.provider;
    const wallet = getWallets(provider)[0];
    transferApp = await deployContract(wallet, FastSignedTransferApp);
  });

  it("happy case: sender creates locked tranfers", async () => {
    const sender = mkAddress("0xa");
    const receiver = mkAddress("0xb");
    const preState: FastGenericSignedTransferAppState = {
      coinTransfers: [
        {
          amount: bigNumberify(10),
          to: sender,
        },
        {
          amount: Zero,
          to: receiver,
        },
      ],
      finalized: false,
      lockedPayments: [],
      turnNum: Zero,
    };

    const action: FastGenericSignedTransferAppAction = {
      actionType: ActionType.CREATE,
      newLockedPayments: [
        {
          amount: One,
          assetId: AddressZero,
          data: mkHash("0x0"),
          paymentId: mkHash("0xa"),
          recipientXpub: mkXpub("xpubB"),
          signature: mkSig("0x0"),
          signer: mkAddress("0xc"),
          timeout: Zero,
        },
      ],
    };

    const ret = await takeAction(preState, action);
    const decoded = decodeAppState(ret);
    const destructured = decoded[0];

    // coin transfers decrement from sender
    expect({
      to: destructured.coinTransfers[0].to,
      amount: destructured.coinTransfers[0].amount.toHexString(),
    }).contain({
      ...preState.coinTransfers[0],
      amount: preState.coinTransfers[0].amount
        .sub(action.newLockedPayments[0].amount)
        .toHexString(),
    });
    // coin transfers does not increment receiver until unlocked
    expect({
      to: destructured.coinTransfers[1].to,
      amount: destructured.coinTransfers[1].amount.toHexString(),
    }).contain({
      ...preState.coinTransfers[1],
      amount: preState.coinTransfers[1].amount.toHexString(),
    });

    // not finalized
    expect(destructured.finalized).is.false;

    // locked payment added to state
    expect(destructured.lockedPayments.length).to.eq(1);
    expect(destructured.lockedPayments).contain(action.newLockedPayments[0]);

    // turn num incremented
    expect(destructured.turnNum).to.eq(1);
  });

  it("happy case: receiver unlocks tranfers", () => {});

  it("happy case: receiver rejects tranfers", () => {});

  it("happy case: sender finalizes channel", () => {});

  it("receiver cannot create transfers", () => {});

  it("cannot create duplicate payments", () => {});

  it("cannot create payment for more than remaining balance", () => {});

  it("sender cannot unlock transfer", () => {});

  it("cannot unlock transfer that does not exist", () => {});

  it("cannot unlock transfer with invalid signature", () => {});

  it("sender cannot reject", () => {});

  it("receiver cannot finalize", () => {});
});
