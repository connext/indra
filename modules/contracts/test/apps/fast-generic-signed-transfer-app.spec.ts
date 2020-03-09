import { expect, use } from "chai";
import { solidity, deployContract } from "ethereum-waffle";
import { waffle } from "@nomiclabs/buidler";
import { Contract } from "ethers";
import { defaultAbiCoder, bigNumberify } from "ethers/utils";

import FastSignedTransferApp from "../../build/FastSignedTransferApp.json";

import { mkAddress, mkHash, mkXpub, mkSig } from "../utils";
import { Zero, One, AddressZero, HashZero } from "ethers/constants";
import {
  FastSignedTransferAppActionBigNumber,
  FastSignedTransferAppStateBigNumber,
  FastSignedTransferAppStateEncoding,
  FastSignedTransferAppActionEncoding,
  FastSignedTransferActionType,
} from "@connext/types";

use(solidity);

const decodeAppState = (encodedAppState: string): FastSignedTransferAppStateBigNumber[] =>
  defaultAbiCoder.decode([FastSignedTransferAppStateEncoding], encodedAppState);

const encodeAppState = (state: FastSignedTransferAppStateBigNumber): string => {
  return defaultAbiCoder.encode([FastSignedTransferAppStateEncoding], [state]);
};

const encodeAppAction = (action: FastSignedTransferAppActionBigNumber): string => {
  return defaultAbiCoder.encode([FastSignedTransferAppActionEncoding], [action]);
};

describe("FastGenericSignedTransferApp", () => {
  let transferApp: Contract;

  async function computeOutcome(state: FastSignedTransferAppStateBigNumber): Promise<string> {
    return await transferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function takeAction(
    state: FastSignedTransferAppStateBigNumber,
    action: FastSignedTransferAppActionBigNumber,
  ): Promise<string> {
    return await transferApp.functions.applyAction(encodeAppState(state), encodeAppAction(action));
  }

  beforeEach(async () => {
    const provider = waffle.provider;
    const wallet = provider.getWallets()[0];
    transferApp = await deployContract(wallet, FastSignedTransferApp);
  });

  it("happy case: sender creates locked tranfers", async () => {
    const sender = mkAddress("0xa");
    const receiver = mkAddress("0xb");
    const preState: FastSignedTransferAppStateBigNumber = {
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
      amount: Zero,
      paymentId: HashZero,
      recipientXpub: "",
      signer: AddressZero,
      turnNum: Zero,
    };

    const action: FastSignedTransferAppActionBigNumber = {
      actionType: FastSignedTransferActionType.CREATE,
      amount: One,
      recipientXpub: mkXpub("xpubB"),
      signer: mkAddress("0xC"),
      paymentId: mkHash("0xa"),
      signature: mkSig("0x0"),
      data: mkHash("0x0"),
    };

    const ret = await takeAction(preState, action);
    const decoded = decodeAppState(ret);
    const destructured = decoded[0];

    // coin transfers decrement from sender
    expect({
      to: destructured.coinTransfers[0].to.toLowerCase(),
      amount: destructured.coinTransfers[0].amount.toHexString(),
    }).to.deep.eq({
      to: preState.coinTransfers[0].to.toLowerCase(),
      amount: preState.coinTransfers[0].amount.sub(action.amount).toHexString(),
    });
    // coin transfers does not increment receiver until unlocked
    expect({
      to: destructured.coinTransfers[1].to.toLowerCase(),
      amount: destructured.coinTransfers[1].amount.toHexString(),
    }).to.deep.eq({
      to: preState.coinTransfers[1].to.toLowerCase(),
      amount: preState.coinTransfers[1].amount.toHexString(),
    });

    // locked payment added to state
    expect({
      amount: destructured.amount,
      paymentId: destructured.paymentId,
      recipientXpub: destructured.recipientXpub,
      signer: destructured.signer,
    }).to.deep.contain(action);

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
