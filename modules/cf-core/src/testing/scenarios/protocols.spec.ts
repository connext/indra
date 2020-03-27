import { OutcomeType, ProtocolNames } from "@connext/types";
import { Contract, ContractFactory, Wallet } from "ethers";
import { bigNumberify } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { xkeyKthAddress } from "../../xkeys";

import { toBeEq } from "../bignumber-jest-matcher";
import { AppWithAction } from "../contracts";
import { TestRunner } from "../test-runner";

let wallet: Wallet;
let appWithAction: Contract;

expect.extend({ toBeEq });

enum ActionType {
  SUBMIT_COUNTER_INCREMENT,
  ACCEPT_INCREMENT,
}

beforeAll(async () => {
  wallet = global["wallet"];

  appWithAction = await new ContractFactory(
    AppWithAction.abi,
    AppWithAction.bytecode,
    wallet,
  ).deploy();
});

describe("Three mininodes", () => {
  it("Can run all the protocols", async () => {
    const tr = new TestRunner();
    await tr.connectToGanache();

    await tr.setup();

    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.install, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeB.xpub,
      defaultTimeout: 100,
      appInterface: {
        addr: appWithAction.address,
        stateEncoding: "tuple(uint256 counter)",
        actionEncoding: "tuple(uint8 actionType, uint256 increment)",
      },
      initialState: {
        counter: 0,
      },
      appSeqNo: 1,
      initiatorBalanceDecrement: bigNumberify(0),
      responderBalanceDecrement: bigNumberify(0),
      initiatorDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      responderDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      participants: [
        xkeyKthAddress(tr.mininodeA.xpub, 1),
        xkeyKthAddress(tr.mininodeB.xpub, 1),
      ].sort(),
      multisigAddress: tr.multisigAB,
      disableLimit: false,
    });

    const postInstallChannel = await tr.mininodeA.store.getStateChannel(tr.multisigAB);
    expect(postInstallChannel).toBeDefined;

    const [appInstance] = [...postInstallChannel.appInstances.values()];

    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.update, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeB.xpub,
      multisigAddress: tr.multisigAB,
      appIdentityHash: appInstance.identityHash,
      newState: {
        counter: 1,
      },
    });

    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.takeAction, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeB.xpub,
      multisigAddress: tr.multisigAB,
      appIdentityHash: appInstance.identityHash,
      action: {
        actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
        increment: 1,
      },
    });

    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.uninstall, {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeB.xpub,
      appIdentityHash: appInstance.identityHash,
      multisigAddress: tr.multisigAB,
    });
  });
});
