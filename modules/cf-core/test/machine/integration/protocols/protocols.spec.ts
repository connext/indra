import { OutcomeType } from "@connext/types";
import { Contract, ContractFactory, Wallet } from "ethers";
import { bigNumberify } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../../src/constants";
import { Protocol, xkeyKthAddress } from "../../../../src/machine";
import { AppWithAction } from "../../../contracts";
import { toBeEq } from "../bignumber-jest-matcher";
import { connectToGanache } from "../connect-ganache";

import { TestRunner } from "./test-runner";

let wallet: Wallet;
let appWithAction: Contract;

expect.extend({ toBeEq });

enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT,
}

beforeAll(async () => {
  [{}, wallet, {}] = await connectToGanache();

  appWithAction = await new ContractFactory(
    AppWithAction.abi,
    AppWithAction.evm.bytecode,
    wallet,
  ).deploy();
});

describe("Three mininodes", () => {
  it("Can run all the protocols", async () => {
    const tr = new TestRunner();
    await tr.connectToGanache();

    await tr.setup();

    await tr.mininodeA.protocolRunner.initiateProtocol(Protocol.Install, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeC.xpub,
      defaultTimeout: 100,
      appInterface: {
        addr: appWithAction.address,
        stateEncoding: "tuple(uint256 counter)",
        actionEncoding: "tuple(uint8 actionType, uint256 increment)",
      },
      initialState: {
        counter: 0,
      },
      appSeqNo: 0,
      initiatorBalanceDecrement: bigNumberify(0),
      responderBalanceDecrement: bigNumberify(0),
      initiatorDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      responderDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      participants: [xkeyKthAddress(tr.mininodeA.xpub), xkeyKthAddress(tr.mininodeC.xpub)],
      multisigAddress: tr.multisigAC,
      disableLimit: false,
    });

    const [appInstance] = [
      ...(await tr.mininodeA.store.getStateChannel(tr.multisigAC))!.appInstances.values(),
    ];

    await tr.mininodeA.protocolRunner.initiateProtocol(Protocol.Update, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeC.xpub,
      multisigAddress: tr.multisigAC,
      appIdentityHash: appInstance.identityHash,
      newState: {
        counter: 1,
      },
    });

    await tr.mininodeA.protocolRunner.initiateProtocol(Protocol.TakeAction, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeC.xpub,
      multisigAddress: tr.multisigAC,
      appIdentityHash: appInstance.identityHash,
      action: {
        actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
        increment: 1,
      },
    });

    await tr.mininodeA.protocolRunner.initiateProtocol(Protocol.Uninstall, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeC.xpub,
      appIdentityHash: appInstance.identityHash,
      multisigAddress: tr.multisigAC,
    });
  });
});
