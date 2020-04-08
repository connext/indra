import { NetworkContext, createRandomAddress } from "@connext/types";
import { Contract, Wallet } from "ethers";
import { WeiPerEther } from "ethers/constants";
import { signChannelMessage } from "@connext/crypto";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../constants";
import { SetStateCommitment } from "../../ethereum";
import { FreeBalanceClass, StateChannel } from "../../models";

import { ChallengeRegistry } from "../contracts";
import { toBeEq } from "../bignumber-jest-matcher";
import { getRandomHDNodes } from "../random-signing-keys";
import { getAddress } from "ethers/utils";

// The ChallengeRegistry.setState call _could_ be estimated but we haven't
// written this test to do that yet
const SETSTATE_COMMITMENT_GAS = 6e9;

let wallet: Wallet;
let network: NetworkContext;
let appRegistry: Contract;

expect.extend({ toBeEq });

beforeAll(async () => {
  wallet = global["wallet"];
  network = global["network"];
  appRegistry = new Contract(network.ChallengeRegistry, ChallengeRegistry.abi, wallet);
});

/**
 * @summary Setup a StateChannel then set state on ETH Free Balance
 */
describe("set state on free balance", () => {
  it("should have the correct versionNumber", async done => {
    const [initiatorNode, responderNode] = getRandomHDNodes(2);
    // State channel testing values
    let stateChannel = StateChannel.setupChannel(
      network.IdentityApp,
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      getAddress(createRandomAddress()),
      initiatorNode.neuter().extendedKey,
      responderNode.neuter().extendedKey,
    );

    expect(stateChannel.userNeuteredExtendedKeys[0]).toEqual(initiatorNode.neuter().extendedKey);
    expect(stateChannel.userNeuteredExtendedKeys[1]).toEqual(responderNode.neuter().extendedKey);

    // Set the state to some test values
    stateChannel = stateChannel.setFreeBalance(
      FreeBalanceClass.createWithFundedTokenAmounts(stateChannel.multisigOwners, WeiPerEther, [
        CONVENTION_FOR_ETH_TOKEN_ADDRESS,
      ]),
    );

    const freeBalanceETH = stateChannel.freeBalance;

    const setStateCommitment = new SetStateCommitment(
      network.ChallengeRegistry,
      freeBalanceETH.identity,
      freeBalanceETH.hashOfLatestState,
      freeBalanceETH.versionNumber,
      freeBalanceETH.stateTimeout,
    );
    const setStateCommitmentHash = setStateCommitment.hashToSign();

    await setStateCommitment.addSignatures(
      await signChannelMessage(
        initiatorNode.derivePath(freeBalanceETH.appSeqNo.toString())
          .privateKey, 
        setStateCommitmentHash,
      ),
      await signChannelMessage(
        responderNode.derivePath(freeBalanceETH.appSeqNo.toString())
          .privateKey,
        setStateCommitmentHash,
      ),
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
