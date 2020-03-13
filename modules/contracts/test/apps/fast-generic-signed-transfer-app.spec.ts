import {
  hexMath,
  decodeFastSignedTransferAppState,
  encodeFastSignedTransferAppState,
  encodeFastSignedTransferAppAction,
  FastSignedTransferAppAction,
  FastSignedTransferAppState,
  FastSignedTransferActionType,
} from "@connext/types";
import { waffle } from "@nomiclabs/buidler";
import { expect, use } from "chai";
import { solidity, deployContract } from "ethereum-waffle";
import { Contract } from "ethers";

import FastSignedTransferApp from "../../build/FastSignedTransferApp.json";

import { mkAddress, mkHash, mkXpub, mkSig } from "../utils";
import { AddressZero, HashZero } from "ethers/constants";
import {
} from "@connext/types";

use(solidity);

describe("FastGenericSignedTransferApp", () => {
  let transferApp: Contract;

  async function takeAction(
    state: FastSignedTransferAppState,
    action: FastSignedTransferAppAction,
  ): Promise<string> {
    return await transferApp.functions.applyAction(
      encodeFastSignedTransferAppState(state),
      encodeFastSignedTransferAppAction(action),
    );
  }

  beforeEach(async () => {
    const provider = waffle.provider;
    const wallet = provider.getWallets()[0];
    transferApp = await deployContract(wallet, FastSignedTransferApp);
  });

  it("happy case: sender creates locked tranfers", async () => {
    const sender = mkAddress("0xa");
    const receiver = mkAddress("0xb");
    const preState: FastSignedTransferAppState = {
      coinTransfers: [
        {
          amount: "0x0a",
          to: sender,
        },
        {
          amount: "0x00",
          to: receiver,
        },
      ],
      amount: "0x00",
      paymentId: HashZero,
      recipientXpub: "",
      signer: AddressZero,
      turnNum: 0,
    };

    const action: FastSignedTransferAppAction = {
      actionType: FastSignedTransferActionType.CREATE,
      amount: "0x01",
      recipientXpub: mkXpub("xpubB"),
      signer: mkAddress("0xC"),
      paymentId: mkHash("0xa"),
      signature: mkSig("0x00"),
      data: mkHash("0x00"),
    };

    const ret = await takeAction(preState, action);
    const decoded = decodeFastSignedTransferAppState(ret);

    // coin transfers decrement from sender
    expect({
      to: decoded.coinTransfers[0].to.toLowerCase(),
      amount: decoded.coinTransfers[0].amount,
    }).to.deep.eq({
      to: preState.coinTransfers[0].to.toLowerCase(),
      amount: hexMath.sub(preState.coinTransfers[0].amount, action.amount),
    });

    // coin transfers does not increment receiver until unlocked
    expect({
      to: decoded.coinTransfers[1].to.toLowerCase(),
      amount: decoded.coinTransfers[1].amount,
    }).to.deep.eq({
      to: preState.coinTransfers[1].to.toLowerCase(),
      amount: preState.coinTransfers[1].amount,
    });

    // locked payment added to state
    expect({
      amount: decoded.amount,
      paymentId: decoded.paymentId,
      recipientXpub: decoded.recipientXpub,
      signer: decoded.signer,
    }).to.deep.contain({
      amount: action.amount,
      paymentId: action.paymentId,
      recipientXpub: action.recipientXpub,
      signer: action.signer,
    });

    // turn num incremented
    expect(decoded.turnNum).to.eq("0x01");
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
