import { ChallengeRegistry } from "@connext/contracts";
import { ContractAddresses } from "@connext/types";
import { getRandomAddress, toBN } from "@connext/utils";
import { Contract, Wallet, constants, utils } from "ethers";

import { expect } from "../assertions";
import { SetStateCommitment } from "../../ethereum";
import { FreeBalanceClass, StateChannel } from "../../models";
import { getRandomChannelSigners } from "../random-signing-keys";
import { getChainId, getContractAddresses } from "../utils";

const { WeiPerEther, AddressZero } = constants;
const { getAddress } = utils;

// The ChallengeRegistry.setState call _could_ be estimated but we haven't
// written this test to do that yet
const SETSTATE_COMMITMENT_GAS = 6e9;

let wallet: Wallet;
let contracts: ContractAddresses;
let appRegistry: Contract;

before(async () => {
  wallet = global["wallet"];
  contracts = getContractAddresses();
  appRegistry = new Contract(contracts.ChallengeRegistry, ChallengeRegistry.abi, wallet);
});

/**
 * @summary Setup a StateChannel then set state on ETH Free Balance
 */
describe("set state on free balance", () => {
  it("should have the correct versionNumber", async () => {
    const [initiatorNode, responderNode] = getRandomChannelSigners(2);
    // State channel testing values
    let stateChannel = StateChannel.setupChannel(
      contracts.IdentityApp,
      contracts,
      getAddress(getRandomAddress()),
      getChainId(),
      initiatorNode.publicIdentifier,
      responderNode.publicIdentifier,
    );

    expect(stateChannel.userIdentifiers[0]).to.eq(initiatorNode.publicIdentifier);
    expect(stateChannel.userIdentifiers[1]).to.eq(responderNode.publicIdentifier);

    // Set the state to some test values
    stateChannel = stateChannel.setFreeBalance(
      FreeBalanceClass.createWithFundedTokenAmounts(stateChannel.multisigOwners, WeiPerEther, [
        AddressZero,
      ]),
    );

    const freeBalanceETH = stateChannel.freeBalance;

    const setStateCommitment = new SetStateCommitment(
      contracts.ChallengeRegistry,
      freeBalanceETH.identity,
      freeBalanceETH.hashOfLatestState,
      toBN(freeBalanceETH.versionNumber),
      toBN(freeBalanceETH.stateTimeout),
    );
    const setStateCommitmentHash = setStateCommitment.hashToSign();

    await setStateCommitment.addSignatures(
      await initiatorNode.signMessage(setStateCommitmentHash),
      await responderNode.signMessage(setStateCommitmentHash),
    );

    const setStateTx = await setStateCommitment.getSignedTransaction();

    await wallet.sendTransaction({
      ...setStateTx,
      gasLimit: SETSTATE_COMMITMENT_GAS,
    });

    const contractAppState = await appRegistry.appChallenges(freeBalanceETH.identityHash);

    expect(contractAppState.versionNumber).to.eq(setStateCommitment.versionNumber);
  });
});
