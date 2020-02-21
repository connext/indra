/* global before */
import { expect, use } from "chai";
import { solidity, createMockProvider, getWallets, deployContract } from "ethereum-waffle";
import { Contract } from "ethers";
import { Zero } from "ethers/constants";
import { BigNumber, defaultAbiCoder } from "ethers/utils";

import FastGenericSignedTransferApp from "../../build/FastGenericSignedTransferApp.json";

use(solidity);

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

type Payment = {
  amount: BigNumber;
  assetId: string;
  signer: string;
  paymentID: string;
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

const multiAssetMultiPartyCoinTransferEncoding = `
  tuple(address to, uint256 amount)[2]
`;

const paymentsEncoding = `
  tuple(
    uint256 amount,
    address assetId,
    address signer,
    bytes32 paymentID,
    uint256 timeout,
    bytes recipientXpub,
    bytes32 data,
    bytes signature
  )[]
`;

const transferAppStateEncoding = `
  tuple(
    ${paymentsEncoding} lockedPayments,
    ${multiAssetMultiPartyCoinTransferEncoding} coinTransfers,
    bool finalized,
    uint256 turnNum
  )
`;

const transferAppActionEncoding = `
  tuple(
    ${paymentsEncoding} newLockedPayments,
    uint256 actionType
  )
`;

const decodeAppState = (encodedAppState: string): FastGenericSignedTransferAppState =>
  defaultAbiCoder.decode([transferAppStateEncoding], encodedAppState);

const encodeAppState = (state: FastGenericSignedTransferAppState): string => {
  return defaultAbiCoder.encode([transferAppStateEncoding], [state]);
};

describe("FastGenericSignedTransferApp", () => {
  let transferApp: Contract;

  async function computeOutcome(state: FastGenericSignedTransferAppState): Promise<string> {
    return await transferApp.functions.computeOutcome(encodeAppState(state));
  }

  beforeEach(async () => {
    const provider = createMockProvider();
    const wallet = getWallets(provider)[0];
    transferApp = await deployContract(wallet, FastGenericSignedTransferApp);
  });

  it("happy case: sender creates locked tranfers", () => {});

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
