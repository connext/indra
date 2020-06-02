import { ChallengeRegistry } from "@connext/contracts";
import { ContractAddresses } from "@connext/types";
import { getRandomAddress, toBN } from "@connext/utils";
import { Contract, Wallet, constants, utils } from "ethers";

import { SetStateCommitment } from "../../ethereum";
import { FreeBalanceClass, StateChannel } from "../../models";

import { toBeEq } from "../bignumber-jest-matcher";
import { getRandomChannelSigners } from "../random-signing-keys";

const { WeiPerEther, AddressZero } = constants;
const { getAddress } = utils;

// The ChallengeRegistry.setState call _could_ be estimated but we haven't
// written this test to do that yet
const SETSTATE_COMMITMENT_GAS = 6e9;

let wallet: Wallet;
let contracts: ContractAddresses;
let appRegistry: Contract;

expect.extend({ toBeEq });

beforeAll(async () => {
  wallet = global["wallet"];
  contracts = global["contracts"];
  if (!contracts) {
    throw new Error(
      `Contracts missing: ${JSON.stringify(global["contracts"])} | ${Object.keys(global)}`,
    );
  }
  console.log(``);
  appRegistry = new Contract(contracts.ChallengeRegistry, ChallengeRegistry.abi, wallet);
});

/**
 * @summary Setup a StateChannel then set state on ETH Free Balance
 */
describe("set state on free balance", () => {
  it("should have the correct versionNumber", async (done) => {
    const [initiatorNode, responderNode] = getRandomChannelSigners(2);
    // State channel testing values
    let stateChannel = StateChannel.setupChannel(
      contracts.IdentityApp,
      contracts,
      getAddress(getRandomAddress()),
      initiatorNode.publicIdentifier,
      responderNode.publicIdentifier,
    );

    expect(stateChannel.userIdentifiers[0]).toEqual(initiatorNode.publicIdentifier);
    expect(stateChannel.userIdentifiers[1]).toEqual(responderNode.publicIdentifier);

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

    expect(contractAppState.versionNumber).toBeEq(setStateCommitment.versionNumber);

    done();
  });
});
