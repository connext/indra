import { signChannelMessage } from "@connext/crypto";
import { MinimalTransaction, createRandomAddress, CommitmentTarget } from "@connext/types";
import {
  bigNumberify,
  Interface,
  keccak256,
  solidityPack,
  TransactionDescription,
  getAddress,
} from "ethers/utils";

import { createAppInstanceForTest } from "../testing/utils";
import { getRandomHDNodes } from "../testing/random-signing-keys";
import { generateRandomNetworkContext } from "../testing/mocks";

import { ChallengeRegistry } from "../contracts";
import { Context } from "../types";
import { appIdentityToHash } from "../utils";

import { getSetStateCommitment, SetStateCommitment } from "./set-state-commitment";
import { StateChannel, FreeBalanceClass } from "../models";
import { WeiPerEther } from "ethers/constants";
import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../constants";

/**
 * This test suite decodes a constructed SetState Commitment transaction object
 * to the specifications defined by Counterfactual as can be found here:
 * https://specs.counterfactual.com/06-update-protocol#commitments
 */
describe("Set State Commitment", () => {
  let commitment: SetStateCommitment;
  let tx: MinimalTransaction;

  const context = { network: generateRandomNetworkContext() } as Context;

  const [initiator, responder] = getRandomHDNodes(2);

  // State channel testing values
  let stateChannel = StateChannel.setupChannel(
    context.network.IdentityApp,
    {
      proxyFactory: context.network.ProxyFactory,
      multisigMastercopy: context.network.MinimumViableMultisig,
    },
    getAddress(createRandomAddress()),
    initiator.neuter().extendedKey,
    responder.neuter().extendedKey,
  );

  expect(stateChannel.userNeuteredExtendedKeys[0]).toEqual(initiator.neuter().extendedKey);
  expect(stateChannel.userNeuteredExtendedKeys[1]).toEqual(responder.neuter().extendedKey);

  // Set the state to some test values
  stateChannel = stateChannel.setFreeBalance(
    FreeBalanceClass.createWithFundedTokenAmounts(stateChannel.multisigOwners, WeiPerEther, [
      CONVENTION_FOR_ETH_TOKEN_ADDRESS,
    ]),
  );

  const appInstance = createAppInstanceForTest(stateChannel);

  const signWithEphemeralKey = async (hash: string, path: number | string) => {
    const initiatorSig = await signChannelMessage(
      initiator.derivePath(path.toString()).privateKey,
      hash,
    );
    const responderSig = await signChannelMessage(
      responder.derivePath(path.toString()).privateKey,
      hash,
    );
    return [initiatorSig, responderSig];
  };

  beforeAll(async () => {
    commitment = getSetStateCommitment(context, appInstance);
    const [
      initiatorSig,
      responderSig,
    ] = await signWithEphemeralKey(commitment.hashToSign(), appInstance.appSeqNo);
    await commitment.addSignatures(
      initiatorSig,
      responderSig,
    );
    // TODO: (question) Should there be a way to retrieve the version
    //       of this transaction sent to the multisig vs sent
    //       directly to the app registry?
    tx = await commitment.getSignedTransaction();
  });

  it("should be to ChallengeRegistry", () => {
    expect(tx.to).toBe(context.network.ChallengeRegistry);
  });

  it("should have no value", () => {
    expect(tx.value).toBe(0);
  });

  describe("the calldata", () => {
    const iface = new Interface(ChallengeRegistry.abi);
    let desc: TransactionDescription;

    beforeAll(() => {
      const { data } = tx;
      desc = iface.parseTransaction({ data });
    });

    it("should be to the setState method", () => {
      expect(desc.sighash).toBe(iface.functions.setState.sighash);
    });

    it("should contain expected AppIdentity argument", () => {
      const [channelNonce, participants, multisigAddress, appDefinition, defaultTimeout] = desc.args[0];

      expect(channelNonce).toEqual(bigNumberify(appInstance.identity.channelNonce));
      expect(participants).toEqual(appInstance.identity.participants);
      expect(multisigAddress).toBe(appInstance.multisigAddress);
      expect(appDefinition).toBe(appInstance.identity.appDefinition);
      expect(defaultTimeout).toEqual(bigNumberify(appInstance.identity.defaultTimeout));
    });

    it("should contain expected SignedAppChallengeUpdate argument", () => {
      const [stateHash, versionNumber, timeout, []] = desc.args[1];
      expect(stateHash).toBe(appInstance.hashOfLatestState);
      expect(versionNumber).toEqual(bigNumberify(appInstance.versionNumber));
      expect(timeout).toEqual(bigNumberify(appInstance.timeout));
    });
  });

  it("should produce the correct hash to sign", () => {
    const hashToSign = commitment.hashToSign();

    // Based on MChallengeRegistryCore::computeStateHash
    // TODO: Probably should be able to compute this from some helper
    //       function ... maybe an ChallengeRegistry class or something
    const expectedHashToSign = keccak256(
      solidityPack(
        ["uint8", "bytes32", "bytes32", "uint256", "uint256"],
        [
          CommitmentTarget.SET_STATE,
          appIdentityToHash(appInstance.identity),
          appInstance.hashOfLatestState,
          appInstance.versionNumber,
          appInstance.timeout,
        ],
      ),
    );

    expect(hashToSign).toBe(expectedHashToSign);
  });
});
