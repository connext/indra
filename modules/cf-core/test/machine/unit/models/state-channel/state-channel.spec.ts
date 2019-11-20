import { getAddress, hexlify, randomBytes } from "ethers/utils";

import { StateChannel, StateChannelJSON, AppInstance } from "../../../../../src/models";
import { getRandomExtendedPubKeys } from "../../../integration/random-signing-keys";
import { generateRandomNetworkContext } from "../../../mocks";

describe("StateChannel", () => {
  it("should be able to instantiate", () => {
    const multisigAddress = getAddress(hexlify(randomBytes(20)));
    const xpubs = getRandomExtendedPubKeys(2);

    const sc = new StateChannel(multisigAddress, xpubs);

    expect(sc).not.toBe(null);
    expect(sc).not.toBe(undefined);
    expect(sc.multisigAddress).toBe(multisigAddress);
    expect(sc.userNeuteredExtendedKeys).toBe(xpubs);
    expect(sc.numActiveApps).toBe(0);
    expect(sc.numProposedApps).toBe(0);
  });

  describe("should be able to write a channel to a json", () => {
    const multisigAddress = getAddress(hexlify(randomBytes(20)));
    const xpubs = getRandomExtendedPubKeys(2);

    const { IdentityApp } = generateRandomNetworkContext();

    let sc: StateChannel;
    let json: StateChannelJSON;

    beforeAll(() => {
      // NOTE: this functionality is tested in `setup-channel.spec`
      sc = StateChannel.setupChannel(IdentityApp, multisigAddress, xpubs);
      json = sc.toJson();
    });

    it("it should have app instance arrays", () => {
      expect(json.appInstances).toEqual([]);
    });

    it("should have proposed app instance array", () => {
      expect(json.proposedAppInstances).toEqual([]);
    });

    it("should have a free balance app instance", () => {
      expect(json.freeBalanceAppInstance).toBeDefined();
    });

    it("should not change the user xpubs", () => {
      expect(json.userNeuteredExtendedKeys).toEqual(xpubs);
    });

    it("should not change the multisig address", () => {
      expect(json.multisigAddress).toEqual(multisigAddress);
    });

    it("should have a singleAssetTwoPartyIntermediaryAgreements array", () => {
      expect(json.singleAssetTwoPartyIntermediaryAgreements).toEqual([]);
    });
  });

  describe("should be able to rehydrate from json", () => {
    const multisigAddress = getAddress(hexlify(randomBytes(20)));
    const xpubs = getRandomExtendedPubKeys(2);

    const { IdentityApp } = generateRandomNetworkContext();

    let sc: StateChannel;
    let json: StateChannelJSON;
    let rehydrated: StateChannel;

    beforeAll(() => {
      // NOTE: this functionality is tested in `setup-channel.spec`
      sc = StateChannel.setupChannel(IdentityApp, multisigAddress, xpubs);
      json = sc.toJson();
      rehydrated = StateChannel.fromJson(json);
    });

    it("should work", () => {
      expect(rehydrated).toEqual(sc);
    });

    it("should have app instance maps", () => {
      expect(rehydrated.appInstances).toEqual(sc.appInstances);
    });

    it("should have proposed app instance maps", () => {
      expect(rehydrated.proposedAppInstances).toEqual(sc.proposedAppInstances);
    });

    it("should have a free balance app instance", () => {
      expect(rehydrated.freeBalance).toEqual(sc.freeBalance);
    });

    it("should not change the user xpubs", () => {
      expect(rehydrated.userNeuteredExtendedKeys).toEqual(sc.userNeuteredExtendedKeys);
    });

    it("should not change the multisig address", () => {
      expect(rehydrated.multisigAddress).toEqual(sc.multisigAddress);
    });

    it("should have a singleAssetTwoPartyIntermediaryAgreements array", () => {
      expect(rehydrated.singleAssetTwoPartyIntermediaryAgreements).toEqual(sc.singleAssetTwoPartyIntermediaryAgreements);
    });
  });
});
