import { getRandomAddress, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants, utils } from "ethers";

import { createAppInstanceForTest, createAppInstanceProposalForTest } from "../../testing/utils";
import { generateRandomNetworkContext } from "../../testing/mocks";

import { StateChannel } from "../state-channel";
import { FreeBalanceClass } from "../free-balance";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";

describe("StateChannel::uninstallApp", () => {
  const networkContext = generateRandomNetworkContext();

  let sc1: StateChannel;
  let sc2: StateChannel;

  let appIdentityHash: string;

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

    const appInstance = createAppInstanceForTest(sc1);
    sc1 = sc1.addProposal(createAppInstanceProposalForTest(appInstance.identityHash, sc1))

    appIdentityHash = appInstance.identityHash;

    // Give 1 ETH to Alice and to Bob so they can spend it on the new app

    sc1 = sc1.setFreeBalance(
      FreeBalanceClass.createWithFundedTokenAmounts(
        [
          getSignerAddressFromPublicIdentifier(ids[0]),
          getSignerAddressFromPublicIdentifier(ids[1]),
        ],
        constants.WeiPerEther,
        [constants.AddressZero],
      ),
    );

    sc2 = sc1.installApp(appInstance, {
      [constants.AddressZero]: {
        [getSignerAddressFromPublicIdentifier(ids[0])]: constants.WeiPerEther,
        [getSignerAddressFromPublicIdentifier(ids[1])]: constants.WeiPerEther,
      },
    });
  });

  it("should not alter any of the base properties", () => {
    expect(sc2.multisigAddress).toBe(sc1.multisigAddress);
    expect(sc2.userIdentifiers).toMatchObject(sc1.userIdentifiers);
  });

  it("should have added something at the id of thew new app", () => {
    expect(sc2.getAppInstance(appIdentityHash)).not.toBe(undefined);
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
