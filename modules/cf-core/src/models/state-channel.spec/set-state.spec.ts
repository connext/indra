import { getRandomAddress, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants, utils } from "ethers";

import { createAppInstanceForTest, createAppInstanceJsonForTest } from "../../testing/utils";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";
import { getRandomContractAddresses } from "../../testing/mocks";

import { AppInstance } from "../app-instance";
import { StateChannel } from "../state-channel";

const { AddressZero, Zero } = constants;
const { getAddress } = utils;

const APP_STATE = {
  foo: AddressZero,
  bar: 42,
};

describe("StateChannel::setState", () => {
  const contractAddresses = getRandomContractAddresses();

  let sc1: StateChannel;
  let sc2: StateChannel;
  let appInstance: AppInstance;

  beforeAll(() => {
    const multisigAddress = getAddress(getRandomAddress());
    const ids = getRandomPublicIdentifiers(2);

    sc1 = StateChannel.setupChannel(
      contractAddresses.IdentityApp,
      contractAddresses,
      multisigAddress,
      ids[0],
      ids[1],
    );

    appInstance = createAppInstanceForTest(sc1);
    sc1 = sc1.addProposal(createAppInstanceJsonForTest(appInstance.identityHash, sc1));

    sc1 = sc1.installApp(appInstance, {
      [AddressZero]: {
        [getSignerAddressFromPublicIdentifier(ids[0])]: Zero,
        [getSignerAddressFromPublicIdentifier(ids[1])]: Zero,
      },
    });

    sc2 = sc1.setState(appInstance, APP_STATE);
  });

  it("should not alter any of the base properties", () => {
    expect(sc2.multisigAddress).toBe(sc1.multisigAddress);
    expect(sc2.userIdentifiers).toMatchObject(sc1.userIdentifiers);
  });

  it("should not have bumped the sequence number", () => {
    expect(sc2.numProposedApps).toBe(sc1.numProposedApps);
  });

  describe("the updated app", () => {
    let app: AppInstance;

    beforeAll(() => {
      app = sc2.getAppInstance(appInstance.identityHash)!;
    });

    it("should have the new state", () => {
      expect(app.state).toEqual(APP_STATE);
    });

    it("should have bumped the versionNumber", () => {
      expect(app.versionNumber).toBe(appInstance.versionNumber + 1);
    });

    it("should have used the default timeout", () => {
      expect(app.timeout).toBe(app.timeout);
    });
  });
});
