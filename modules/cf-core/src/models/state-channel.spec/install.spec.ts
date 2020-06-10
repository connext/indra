import { getRandomAddress, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { constants, utils } from "ethers";

import { createAppInstanceForTest, createAppInstanceJsonForTest } from "../../testing/utils";
import { getRandomContractAddresses } from "../../testing/mocks";

import { StateChannel } from "../state-channel";
import { FreeBalanceClass } from "../free-balance";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";

const { WeiPerEther, Zero, AddressZero } = constants;
const { getAddress } = utils;

describe("StateChannel::uninstallApp", () => {
  const contractAddresses = getRandomContractAddresses();

  let sc1: StateChannel;
  let sc2: StateChannel;

  let appIdentityHash: string;

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

    const appInstance = createAppInstanceForTest(sc1);
    sc1 = sc1.addProposal(createAppInstanceJsonForTest(appInstance.identityHash, sc1));

    appIdentityHash = appInstance.identityHash;

    // Give 1 ETH to Alice and to Bob so they can spend it on the new app

    sc1 = sc1.setFreeBalance(
      FreeBalanceClass.createWithFundedTokenAmounts(
        [
          getSignerAddressFromPublicIdentifier(ids[0]),
          getSignerAddressFromPublicIdentifier(ids[1]),
        ],
        WeiPerEther,
        [AddressZero],
      ),
    );

    sc2 = sc1.installApp(appInstance, {
      [AddressZero]: {
        [getSignerAddressFromPublicIdentifier(ids[0])]: WeiPerEther,
        [getSignerAddressFromPublicIdentifier(ids[1])]: WeiPerEther,
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
      for (const amount of Object.values(fb.withTokenAddress(AddressZero) || {})) {
        expect(amount).toEqual(Zero);
      }
    });
  });
});
