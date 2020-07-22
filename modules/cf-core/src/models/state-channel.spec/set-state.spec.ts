import { getRandomAddress, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants, utils } from "ethers";

import { expect } from "../../testing/assertions";
import { getRandomContractAddresses } from "../../testing/mocks";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";
import {
  createAppInstanceForTest,
  createAppInstanceJsonForTest,
  getChainId,
} from "../../testing/utils";

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

  before(() => {
    const multisigAddress = getAddress(getRandomAddress());
    const ids = getRandomPublicIdentifiers(2);

    sc1 = StateChannel.setupChannel(
      contractAddresses.IdentityApp,
      contractAddresses,
      multisigAddress,
      getChainId(),
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
    expect(sc2.multisigAddress).to.eq(sc1.multisigAddress);
    expect(sc2.userIdentifiers).to.deep.eq(sc1.userIdentifiers);
  });

  it("should not have bumped the sequence number", () => {
    expect(sc2.numProposedApps).to.eq(sc1.numProposedApps);
  });

  describe("the updated app", () => {
    let app: AppInstance;

    before(() => {
      app = sc2.getAppInstance(appInstance.identityHash)!;
    });

    it("should have the new state", () => {
      expect(app.state).to.deep.eq(APP_STATE);
    });

    it("should have bumped the versionNumber", () => {
      expect(app.versionNumber).to.eq(appInstance.versionNumber + 1);
    });

    it("should have used the default timeout", () => {
      expect(app.timeout).to.eq(app.timeout);
    });
  });
});
