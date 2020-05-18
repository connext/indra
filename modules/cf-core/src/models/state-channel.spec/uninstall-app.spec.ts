import { getRandomAddress, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { utils, constants } from "ethers";

import { createAppInstanceForTest, createAppInstanceProposalForTest } from "../../testing/utils";
import { generateRandomNetworkContext } from "../../testing/mocks";

import { AppInstance } from "../app-instance";
import { StateChannel } from "../state-channel";
import { FreeBalanceClass } from "../free-balance";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";

describe("StateChannel::uninstallApp", () => {
  const networkContext = generateRandomNetworkContext();

  let sc1: StateChannel;
  let sc2: StateChannel;
  let appInstance: AppInstance;

  beforeAll(() => {
    const multisigAddress = utils.getAddress(getRandomAddress());
    const ids = getRandomPublicIdentifiers(2);

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

    appInstance = createAppInstanceForTest(sc1);
    sc1 = sc1.addProposal(createAppInstanceProposalForTest(appInstance.identityHash, sc1));

    sc1 = sc1.installApp(appInstance, {
      [constants.AddressZero]: {
        [getSignerAddressFromPublicIdentifier(ids[0])]: constants.Zero,
        [getSignerAddressFromPublicIdentifier(ids[1])]: constants.Zero,
      },
    });

    sc2 = sc1.uninstallApp(appInstance, {
      [constants.AddressZero]: {
        [getSignerAddressFromPublicIdentifier(ids[0])]: constants.Zero,
        [getSignerAddressFromPublicIdentifier(ids[1])]: constants.Zero,
      },
    });
  });

  it("should not alter any of the base properties", () => {
    expect(sc2.multisigAddress).toBe(sc1.multisigAddress);
    expect(sc2.userIdentifiers).toMatchObject(sc1.userIdentifiers);
  });

  it("should not have changed the sequence number", () => {
    expect(sc2.numProposedApps).toBe(sc1.numProposedApps);
  });

  it("should have decreased the active apps number", () => {
    expect(sc2.numActiveApps).toBe(sc1.numActiveApps - 1);
  });

  it("should have deleted the app being uninstalled", () => {
    expect(sc2.isAppInstanceInstalled(appInstance.identityHash)).toBe(false);
  });

  describe("the updated ETH Free Balance", () => {
    let fb: FreeBalanceClass;

    beforeAll(() => {
      fb = sc2.getFreeBalanceClass();
    });

    it("should have updated balances for Alice and Bob", () => {
      for (const amount of Object.values(fb.withTokenAddress(constants.AddressZero) || {})) {
        expect(amount).toEqual(constants.Zero);
      }
    });
  });
});
