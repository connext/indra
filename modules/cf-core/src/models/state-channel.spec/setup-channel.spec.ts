import { AppInstanceJson } from "@connext/types";
import { getRandomAddress, getSignerAddressFromPublicIdentifier, toBN } from "@connext/utils";
import { constants, utils } from "ethers";

import { HARD_CODED_ASSUMPTIONS } from "../../constants";
import { expect } from "../../testing/assertions";
import { getRandomContractAddresses } from "../../testing/mocks";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";
import { getChainId } from "../../testing/utils";

import { AppInstance } from "../app-instance";
import { StateChannel } from "../state-channel";

const { Zero, AddressZero } = constants;
const { getAddress } = utils;

describe("StateChannel::setupChannel", () => {
  const multisigAddress = getAddress(getRandomAddress());
  const ids = getRandomPublicIdentifiers(2);

  let sc: StateChannel;

  const contractAddresses = getRandomContractAddresses();

  before(() => {
    sc = StateChannel.setupChannel(
      contractAddresses.IdentityApp,
      contractAddresses,
      multisigAddress,
      getChainId(),
      ids[0],
      ids[1],
    );
  });

  it("should have empty map for proposed app instances", () => {
    expect(sc.proposedAppInstances).to.deep.eq(new Map<string, AppInstanceJson>());
  });

  it("should have empty map for app instances", () => {
    expect(sc.appInstances).to.deep.eq(new Map<string, AppInstance>());
  });

  it("should not alter any of the base properties", () => {
    expect(sc.multisigAddress).to.eq(multisigAddress);
    expect(sc.userIdentifiers).to.deep.eq(ids);
  });

  it("should have bumped the sequence number", () => {
    expect(sc.numProposedApps).to.eq(1);
  });

  describe("the installed ETH Free Balance", () => {
    let fb: AppInstance;

    before(() => {
      fb = sc.freeBalance;
    });

    it("should exist", () => {
      expect(fb).not.to.eq(undefined);
    });

    it("should have versionNumber 1 to start", () => {
      expect(fb.versionNumber).to.eq(1);
    });

    it("should have a default timeout defined by the hard-coded assumption", () => {
      // See HARD_CODED_ASSUMPTIONS in state-channel.ts
      expect(fb.defaultTimeout).to.eq(
        toBN(HARD_CODED_ASSUMPTIONS.freeBalanceDefaultTimeout).toHexString(),
      );
    });

    it("should use the default timeout for the initial timeout", () => {
      expect(fb.stateTimeout).to.eq(
        toBN(HARD_CODED_ASSUMPTIONS.freeBalanceInitialStateTimeout).toHexString(),
      );
    });

    it("should use the multisig owners as the participants", () => {
      expect([
        getSignerAddressFromPublicIdentifier(fb.initiatorIdentifier),
        getSignerAddressFromPublicIdentifier(fb.responderIdentifier),
      ]).to.deep.eq(sc.multisigOwners);
    });

    it("should use the FreeBalanceAppApp as the app target", () => {
      expect(fb.appDefinition).to.eq(contractAddresses.IdentityApp);
      expect(fb.abiEncodings.actionEncoding).to.eq(undefined);
    });

    it("should have seqNo of 1 (b/c it is the first ever app)", () => {
      expect(fb.appSeqNo).to.eq(1);
    });

    it("should set the participants as the userIdentifiers", () => {});

    it("should have 0 balances for Alice and Bob", () => {
      for (const amount of Object.values(
        sc.getFreeBalanceClass().withTokenAddress(AddressZero) || {},
      )) {
        expect(amount).to.eq(Zero);
      }
    });
  });
});
