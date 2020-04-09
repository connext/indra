import { MinimalTransaction, createRandomAddress } from "@connext/types";
import {
  bigNumberify,
  Interface,
  keccak256,
  solidityPack,
  TransactionDescription,
  getAddress,
} from "ethers/utils";

import { createAppInstanceForTest } from "../testing/utils";
import { generateRandomNetworkContext } from "../testing/mocks";

import { ChallengeRegistry } from "../contracts";
import { Context } from "../types";
import { appIdentityToHash } from "../utils";

import { getSetStateCommitment, SetStateCommitment } from "./set-state-commitment";
import { StateChannel, FreeBalanceClass } from "../models";
import { WeiPerEther, AddressZero } from "ethers/constants";
import { getRandomChannelSigners } from "../testing/random-signing-keys";

/**
 * This test suite decodes a constructed SetState Commitment transaction object
 * to the specifications defined by Counterfactual as can be found here:
 * https://specs.counterfactual.com/06-update-protocol#commitments
 */
describe("Set State Commitment", () => {
  let commitment: SetStateCommitment;
  let tx: MinimalTransaction;

  const context = { network: generateRandomNetworkContext() } as Context;

  const [initiator, responder] = getRandomChannelSigners(2);

  // State channel testing values
  let stateChannel = StateChannel.setupChannel(
    context.network.IdentityApp,
    {
      proxyFactory: context.network.ProxyFactory,
      multisigMastercopy: context.network.MinimumViableMultisig,
    },
    getAddress(createRandomAddress()),
    initiator.address,
    responder.address,
  );

  expect(stateChannel.userPublicIdentifiers[0]).toEqual(initiator.address);
  expect(stateChannel.userPublicIdentifiers[1]).toEqual(responder.address);

  // Set the state to some test values
  stateChannel = stateChannel.setFreeBalance(
    FreeBalanceClass.createWithFundedTokenAmounts(stateChannel.multisigOwners, WeiPerEther, [
      AddressZero,
    ]),
  );

  const appInstance = createAppInstanceForTest(stateChannel);

  const signWithEphemeralKey = async (hash: string) => {
    const initiatorSig = await initiator.signMessage(hash);
    const responderSig = await responder.signMessage(hash);
    return [initiatorSig, responderSig];
  };

  beforeAll(async () => {
    commitment = getSetStateCommitment(context, appInstance);
    const [
      initiatorSig,
      responderSig,
    ] = await signWithEphemeralKey(commitment.hashToSign());
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
        ["bytes1", "bytes32", "uint256", "uint256", "bytes32"],
        [
          "0x19",
          appIdentityToHash(appInstance.identity),
          appInstance.versionNumber,
          appInstance.timeout,
          appInstance.hashOfLatestState,
        ],
      ),
    );

    expect(hashToSign).toBe(expectedHashToSign);
  });
});
