import { OutcomeType, ProtocolNames, ProtocolParams } from "@connext/types";
import { Contract, ContractFactory, Wallet } from "ethers";
import { Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { StateChannel } from "../../models";
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

    const proposalParams: ProtocolParams.Propose = {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeB.xpub,
      defaultTimeout: bigNumberify(100),
      stateTimeout: Zero,
      appDefinition: appWithAction.address,
      abiEncodings: {
        stateEncoding: "tuple(uint256 counter)",
        actionEncoding: "tuple(uint8 actionType, uint256 increment)",
      },
      initialState: {
        counter: 0,
      },
      initiatorDeposit: bigNumberify(0),
      responderDeposit: bigNumberify(0),
      initiatorDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      responderDepositTokenAddress: CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      outcomeType: OutcomeType.TWO_PARTY_FIXED_OUTCOME,
      multisigAddress: tr.multisigAB,
    };

    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.propose, proposalParams);

    const postProposalStateChannel = await tr.mininodeA.store.getStateChannel(tr.multisigAB);
    expect(postProposalStateChannel).toBeDefined;

    const [proposal] = [
      ...StateChannel.fromJson(postProposalStateChannel!).proposedAppInstances.values(),
    ];
    expect(proposal).toBeTruthy();

    const installParams: ProtocolParams.Install = {
      initiatorXpub: tr.mininodeA.xpub,
      responderXpub: tr.mininodeB.xpub,
      initiatorDepositTokenAddress: proposal.initiatorDepositTokenAddress,
      responderDepositTokenAddress: proposal.responderDepositTokenAddress,
      multisigAddress: tr.multisigAB,
      initiatorBalanceDecrement: bigNumberify(0),
      responderBalanceDecrement: bigNumberify(0),
      initialState: proposal.initialState,
      appInterface: {
        addr: proposal.appDefinition,
        stateEncoding: proposal.abiEncodings.stateEncoding,
        actionEncoding: proposal.abiEncodings.actionEncoding,
      },
      appInitiatorAddress: xkeyKthAddress(proposal.proposedByIdentifier, proposal.appSeqNo),
      appResponderAddress: xkeyKthAddress(proposal.proposedToIdentifier, proposal.appSeqNo),
      defaultTimeout: bigNumberify(100),
      stateTimeout: Zero,
      appSeqNo: proposal.appSeqNo,
      outcomeType: proposal.outcomeType,
      disableLimit: false,
    };
    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.install, installParams);

    const postInstallChannel = await tr.mininodeA.store.getStateChannel(tr.multisigAB);
    expect(postInstallChannel).toBeDefined;

    const [appInstance] = [...StateChannel.fromJson(postInstallChannel!).appInstances.values()];

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
