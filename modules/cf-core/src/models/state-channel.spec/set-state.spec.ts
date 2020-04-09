import { AddressZero, Zero } from "ethers/constants";
import { getAddress } from "ethers/utils";
import { createRandomAddress, getAddressFromIdentifier } from "@connext/types";

import { createAppInstanceForTest } from "../../testing/utils";
import { getRandomChannelIdentifiers } from "../../testing/random-signing-keys";
import { generateRandomNetworkContext } from "../../testing/mocks";

import { AppInstance } from "../app-instance";
import { StateChannel } from "../state-channel";

const APP_STATE = {
  foo: AddressZero,
  bar: 42,
};

describe("StateChannel::setState", () => {
  const networkContext = generateRandomNetworkContext();

  let sc1: StateChannel;
  let sc2: StateChannel;
  let testApp: AppInstance;

  beforeAll(() => {
    const multisigAddress = getAddress(createRandomAddress());
    const ids = getRandomChannelIdentifiers(2);

    sc1 = StateChannel.setupChannel(
      networkContext.IdentityApp,
      {
        proxyFactory: networkContext.ProxyFactory,
        multisigMastercopy: networkContext.MinimumViableMultisig,
      },
      multisigAddress,
      ids[0],
      ids[1],
    );

    testApp = createAppInstanceForTest(sc1);

    sc1 = sc1.installApp(testApp, {
      [AddressZero]: {
        [getAddressFromIdentifier(ids[0])]: Zero,
        [getAddressFromIdentifier(ids[1])]: Zero,
      },
    });

    sc2 = sc1.setState(testApp, APP_STATE);
  });

  it("should not alter any of the base properties", () => {
    expect(sc2.multisigAddress).toBe(sc1.multisigAddress);
    expect(sc2.userPublicIdentifiers).toMatchObject(sc1.userPublicIdentifiers);
  });

  it("should not have bumped the sequence number", () => {
    expect(sc2.numProposedApps).toBe(sc1.numProposedApps);
  });

  describe("the updated app", () => {
    let app: AppInstance;

    beforeAll(() => {
      app = sc2.getAppInstance(testApp.identityHash)!;
    });

    it("should have the new state", () => {
      expect(app.state).toEqual(APP_STATE);
    });

    it("should have bumped the versionNumber", () => {
      expect(app.versionNumber).toBe(testApp.versionNumber + 1);
    });

    it("should have used the default timeout", () => {
      expect(app.timeout).toBe(app.timeout);
    });
  });
});
