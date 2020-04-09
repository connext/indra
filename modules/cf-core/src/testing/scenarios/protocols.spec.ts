import { OutcomeType, ProtocolNames, ProtocolParams } from "@connext/types";
import { Contract, ContractFactory, Wallet } from "ethers";
import { Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";

import { StateChannel } from "../../models";

import { toBeEq } from "../bignumber-jest-matcher";
import { AppWithAction } from "../contracts";
import { TestRunner } from "../test-runner";
import { CONVENTION_FOR_ETH_ASSET_ID_GANACHE } from "../utils";

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
      initiatorIdentifier: tr.mininodeA.address,
      responderIdentifier: tr.mininodeB.address,
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
      initiatorDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
      responderDepositAssetId: CONVENTION_FOR_ETH_ASSET_ID_GANACHE,
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
      initiatorIdentifier: tr.mininodeA.address,
      responderIdentifier: tr.mininodeB.address,
      initiatorDepositAssetId: proposal.initiatorDepositAssetId,
      responderDepositAssetId: proposal.responderDepositAssetId,
      multisigAddress: tr.multisigAB,
      initiatorBalanceDecrement: bigNumberify(0),
      responderBalanceDecrement: bigNumberify(0),
      initialState: proposal.initialState,
      appInterface: {
        addr: proposal.appDefinition,
        stateEncoding: proposal.abiEncodings.stateEncoding,
        actionEncoding: proposal.abiEncodings.actionEncoding,
      },
      appInitiatorIdentifier: proposal.initiatorIdentifier,
      appResponderIdentifier: proposal.responderIdentifier,
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
      initiatorIdentifier: tr.mininodeA.address,
      responderIdentifier: tr.mininodeB.address,
      multisigAddress: tr.multisigAB,
      appIdentityHash: appInstance.identityHash,
      newState: {
        counter: 1,
      },
    });

    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.takeAction, {
      initiatorIdentifier: tr.mininodeA.address,
      responderIdentifier: tr.mininodeB.address,
      multisigAddress: tr.multisigAB,
      appIdentityHash: appInstance.identityHash,
      action: {
        actionType: ActionType.SUBMIT_COUNTER_INCREMENT,
        increment: 1,
      },
    });

    await tr.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.uninstall, {
      initiatorIdentifier: tr.mininodeA.address,
      responderIdentifier: tr.mininodeB.address,
      appIdentityHash: appInstance.identityHash,
      multisigAddress: tr.multisigAB,
    });
  });
});
