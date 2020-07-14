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
import { FreeBalanceClass } from "../free-balance";
import { StateChannel } from "../state-channel";

const { Zero, AddressZero } = constants;
const { getAddress } = utils;

describe("StateChannel::uninstallApp", () => {
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

    sc2 = sc1.uninstallApp(appInstance, {
      [AddressZero]: {
        [getSignerAddressFromPublicIdentifier(ids[0])]: Zero,
        [getSignerAddressFromPublicIdentifier(ids[1])]: Zero,
      },
    });
  });

  it("should not alter any of the base properties", () => {
    expect(sc2.multisigAddress).to.eq(sc1.multisigAddress);
    expect(sc2.userIdentifiers).to.deep.eq(sc1.userIdentifiers);
  });

  it("should not have changed the sequence number", () => {
    expect(sc2.numProposedApps).to.eq(sc1.numProposedApps);
  });

  it("should have decreased the active apps number", () => {
    expect(sc2.numActiveApps).to.eq(sc1.numActiveApps - 1);
  });

  it("should have deleted the app being uninstalled", () => {
    expect(sc2.isAppInstanceInstalled(appInstance.identityHash)).to.eq(false);
  });

  describe("the updated ETH Free Balance", () => {
    let fb: FreeBalanceClass;

    before(() => {
      fb = sc2.getFreeBalanceClass();
    });

    it("should have updated balances for Alice and Bob", () => {
      for (const amount of Object.values(fb.withTokenAddress(AddressZero) || {})) {
        expect(amount).to.eq(Zero);
      }
    });
  });
});
