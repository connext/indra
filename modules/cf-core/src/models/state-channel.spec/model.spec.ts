import { StateChannelJSON } from "@connext/types";
import { bigNumberifyJson, getRandomAddress, getRandomBytes32, toBN } from "@connext/utils";
import { BigNumberish, utils, constants } from "ethers";

import { getRandomContractAddresses } from "../../testing/mocks";

import { StateChannel } from "../state-channel";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";
import { FreeBalanceClass } from "../free-balance";
import { flipTokenIndexedBalances } from "../utils";

const { getAddress } = utils;
const { AddressZero } = constants;

describe("StateChannel", () => {
  test("should be able to instantiate", () => {
    const multisigAddress = getAddress(getRandomAddress());
    const [initiator, responder] = getRandomPublicIdentifiers(2);

    const { ProxyFactory, MinimumViableMultisig } = getRandomContractAddresses();

    const sc = new StateChannel(
      multisigAddress,
      { ProxyFactory, MinimumViableMultisig },
      initiator,
      responder,
    );

    expect(sc).not.toBe(null);
    expect(sc).not.toBe(undefined);
    expect(sc.multisigAddress).toBe(multisigAddress);
    expect(sc.userIdentifiers).toMatchObject([initiator, responder]);
    expect(sc.numActiveApps).toBe(0);
    expect(sc.numProposedApps).toBe(0);
  });

  // TODO: moar tests!
  describe("addActiveAppAndIncrementFreeBalance", () => {
    const multisigAddress = getAddress(getRandomAddress());
    const [initiator, responder] = getRandomPublicIdentifiers(2);
    const { IdentityApp, ProxyFactory, MinimumViableMultisig } = getRandomContractAddresses();
    const tokenAddress = getAddress(getRandomAddress());
    const identityHash = getRandomBytes32();
    const channelInitialDeposit = toBN(15);

    let sc: StateChannel;

    // app specific stuff
    let appInitiator;
    let appResponder;
    let appInitiatorAssetId;
    let appResponderAssetId;

    beforeEach(() => {
      const init = StateChannel.setupChannel(
        IdentityApp,
        { ProxyFactory, MinimumViableMultisig },
        multisigAddress,
        initiator,
        responder,
      );

      // update free balance with initial deposit values
      const freeBalance = FreeBalanceClass.createWithFundedTokenAmounts(
        init.multisigOwners,
        channelInitialDeposit,
        [AddressZero, tokenAddress],
      );
      sc = init.setFreeBalance(freeBalance);
      expect(sc).toBeDefined();
      const freeBalanceClass = sc.getFreeBalanceClass();
      [...init.multisigOwners].forEach((addr) => {
        const eth = freeBalanceClass.getBalance(AddressZero, addr);
        const token = freeBalanceClass.getBalance(tokenAddress, addr);
        expect(eth.toString()).toBe(channelInitialDeposit.toString());
        expect(token.toString()).toBe(channelInitialDeposit.toString());
      });
    });

    describe("channel{initiator,responder} !== app{initiator,responder}", () => {
      beforeEach(() => {
        expect(sc).toBeDefined();
        appInitiator = sc.multisigOwners[1];
        appResponder = sc.multisigOwners[0];
      });

      describe("app deposit asset id is not the same for initiator and responder", () => {
        beforeEach(() => {
          expect(sc).toBeDefined();
          appInitiatorAssetId = tokenAddress; // channel responder
          appResponderAssetId = AddressZero; // channel initiator
        });

        const runTest = (initiatorDeposit: BigNumberish, responderDeposit: BigNumberish) => {
          const balanceDecrements = {
            [appInitiatorAssetId]: {
              [appInitiator]: toBN(initiatorDeposit),
            },
            [appResponderAssetId]: {
              [appResponder]: toBN(responderDeposit),
            },
          };
          // app initiator is channel responder:
          // channel responder token balance decreases
          // channel initiator eth balance decreases
          const expected = {
            [AddressZero]: {
              [sc.multisigOwners[0]]: channelInitialDeposit.sub(responderDeposit),
              [sc.multisigOwners[1]]: channelInitialDeposit,
            },
            [tokenAddress]: {
              [sc.multisigOwners[0]]: channelInitialDeposit,
              [sc.multisigOwners[1]]: channelInitialDeposit.sub(initiatorDeposit),
            },
          };

          const installed = sc.addActiveAppAndIncrementFreeBalance(
            identityHash,
            flipTokenIndexedBalances(balanceDecrements),
          );

          const balancesIndexedByToken = installed
            .getFreeBalanceClass()
            .toTokenIndexedCoinTransferMap();
          // check token address coin transfers
          expect(balancesIndexedByToken).toMatchObject(expected);
        };

        test("should work when responder has no balance change", () => {
          runTest(7, 0);
        });

        test("should work when initiator has no balance change", () => {
          runTest(0, 3);
        });

        test("should work when both initiator and responder have balance changes", async () => {
          runTest(7, 3);
        });
      });
    });
  });

  describe("should be able to write a channel to a json", () => {
    const multisigAddress = getAddress(getRandomAddress());
    const [initiator, responder] = getRandomPublicIdentifiers(2);

    let sc: StateChannel;
    let json: StateChannelJSON;

    const { IdentityApp, ProxyFactory, MinimumViableMultisig } = getRandomContractAddresses();

    beforeAll(() => {
      // NOTE: this functionality is tested in `setup-channel.spec`
      sc = StateChannel.setupChannel(
        IdentityApp,
        { ProxyFactory, MinimumViableMultisig },
        multisigAddress,
        initiator,
        responder,
      );
      json = sc.toJson();
    });

    test("it should have app instance arrays", () => {
      expect(json.appInstances).toEqual([]);
    });

    test("should have proposed app instance array", () => {
      expect(json.proposedAppInstances).toEqual([]);
    });

    test("should have a free balance app instance", () => {
      expect(json.freeBalanceAppInstance).toBeDefined();
    });

    test("should not change the user addresss", () => {
      expect(json.userIdentifiers[0]).toEqual(initiator);
      expect(json.userIdentifiers[1]).toEqual(responder);
    });

    test("should not change the multisig address", () => {
      expect(json.multisigAddress).toEqual(multisigAddress);
    });

    test("should have the correct critical state channel addresses", () => {
      expect(json.addresses.ProxyFactory).toEqual(sc.addresses.ProxyFactory);
      expect(sc.addresses.ProxyFactory).toEqual(ProxyFactory);
      expect(json.addresses.MinimumViableMultisig).toEqual(sc.addresses.MinimumViableMultisig);
      expect(sc.addresses.MinimumViableMultisig).toEqual(MinimumViableMultisig);
    });
  });

  describe("should be able to rehydrate from json", () => {
    const multisigAddress = getAddress(getRandomAddress());
    const [initiator, responder] = getRandomPublicIdentifiers(2);

    const { IdentityApp, ProxyFactory, MinimumViableMultisig } = getRandomContractAddresses();

    let sc: StateChannel;
    let json: StateChannelJSON;
    let rehydrated: StateChannel;

    beforeAll(() => {
      // NOTE: this functionality is tested in `setup-channel.spec`
      sc = StateChannel.setupChannel(
        IdentityApp,
        { ProxyFactory, MinimumViableMultisig },
        multisigAddress,
        initiator,
        responder,
      );
      json = sc.toJson();
      rehydrated = StateChannel.fromJson(json);
    });

    test("should work", () => {
      for (const prop of Object.keys(sc)) {
        if (typeof sc[prop] === "function" || prop === "freeBalanceAppInstance") {
          // skip fns
          // free balance asserted below
          continue;
        }
        expect(rehydrated[prop]).toEqual(sc[prop]);
      }
    });

    test("should have app instance maps", () => {
      expect(rehydrated.appInstances).toEqual(sc.appInstances);
    });

    test("should have proposed app instance maps", () => {
      expect(rehydrated.proposedAppInstances).toEqual(sc.proposedAppInstances);
    });

    test("should have a free balance app instance", () => {
      // will fail because of { _hex: "" } vs BigNumber comparison
      expect(rehydrated.freeBalance).toMatchObject(bigNumberifyJson(sc.freeBalance));
    });

    test("should not change the user addresss", () => {
      expect(rehydrated.userIdentifiers[0]).toEqual(initiator);
      expect(rehydrated.userIdentifiers[1]).toEqual(responder);
    });

    test("should not change the multisig address", () => {
      expect(rehydrated.multisigAddress).toEqual(sc.multisigAddress);
    });
  });
});
