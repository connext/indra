import { StateChannelJSON } from "@connext/types";
import { bigNumberifyJson, getRandomAddress, getRandomBytes32, toBN } from "@connext/utils";
import { BigNumberish, utils, constants } from "ethers";

import { expect } from "../../testing/assertions";
import { getRandomContractAddresses } from "../../testing/mocks";
import { getRandomPublicIdentifiers } from "../../testing/random-signing-keys";
import { getChainId } from "../../testing/utils";

import { StateChannel } from "../state-channel";
import { FreeBalanceClass } from "../free-balance";
import { flipTokenIndexedBalances } from "../utils";

const { getAddress } = utils;
const { AddressZero } = constants;

describe("StateChannel", () => {
  it("should be able to instantiate", () => {
    const multisigAddress = getAddress(getRandomAddress());
    const [initiator, responder] = getRandomPublicIdentifiers(2);

    const { ProxyFactory, MinimumViableMultisig } = getRandomContractAddresses();

    const sc = new StateChannel(
      multisigAddress,
      getChainId(),
      { ProxyFactory, MinimumViableMultisig },
      initiator,
      responder,
    );

    expect(sc).not.to.eq(null);
    expect(sc).not.to.eq(undefined);
    expect(sc.multisigAddress).to.eq(multisigAddress);
    expect(sc.userIdentifiers).to.deep.eq([initiator, responder]);
    expect(sc.numActiveApps).to.eq(0);
    expect(sc.numProposedApps).to.eq(0);
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
        getChainId(),
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
      expect(sc).to.be.ok;
      const freeBalanceClass = sc.getFreeBalanceClass();
      [...init.multisigOwners].forEach((addr) => {
        const eth = freeBalanceClass.getBalance(AddressZero, addr);
        const token = freeBalanceClass.getBalance(tokenAddress, addr);
        expect(eth.toString()).to.eq(channelInitialDeposit.toString());
        expect(token.toString()).to.eq(channelInitialDeposit.toString());
      });
    });

    describe("channel{initiator,responder} !== app{initiator,responder}", () => {
      beforeEach(() => {
        expect(sc).to.be.ok;
        appInitiator = sc.multisigOwners[1];
        appResponder = sc.multisigOwners[0];
      });

      describe("app deposit asset id is not the same for initiator and responder", () => {
        beforeEach(() => {
          expect(sc).to.be.ok;
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
          expect(balancesIndexedByToken).to.deep.eq(expected);
        };

        it("should work when responder has no balance change", () => {
          runTest(7, 0);
        });

        it("should work when initiator has no balance change", () => {
          runTest(0, 3);
        });

        it("should work when both initiator and responder have balance changes", async () => {
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

    before(() => {
      // NOTE: this functionality is tested in `setup-channel.spec`
      sc = StateChannel.setupChannel(
        IdentityApp,
        { ProxyFactory, MinimumViableMultisig },
        multisigAddress,
        getChainId(),
        initiator,
        responder,
      );
      json = sc.toJson();
    });

    it("it should have app instance arrays", () => {
      expect(json.appInstances).to.deep.eq([]);
    });

    it("should have proposed app instance array", () => {
      expect(json.proposedAppInstances).to.deep.eq([]);
    });

    it("should have a free balance app instance", () => {
      expect(json.freeBalanceAppInstance).to.be.ok;
    });

    it("should not change the user addresss", () => {
      expect(json.userIdentifiers[0]).to.eq(initiator);
      expect(json.userIdentifiers[1]).to.eq(responder);
    });

    it("should not change the multisig address", () => {
      expect(json.multisigAddress).to.eq(multisigAddress);
    });

    it("should have the correct critical state channel addresses", () => {
      expect(json.addresses.ProxyFactory).to.eq(sc.addresses.ProxyFactory);
      expect(sc.addresses.ProxyFactory).to.eq(ProxyFactory);
      expect(json.addresses.MinimumViableMultisig).to.eq(sc.addresses.MinimumViableMultisig);
      expect(sc.addresses.MinimumViableMultisig).to.eq(MinimumViableMultisig);
    });
  });

  describe("should be able to rehydrate from json", () => {
    const multisigAddress = getAddress(getRandomAddress());
    const [initiator, responder] = getRandomPublicIdentifiers(2);

    const { IdentityApp, ProxyFactory, MinimumViableMultisig } = getRandomContractAddresses();

    let sc: StateChannel;
    let json: StateChannelJSON;
    let rehydrated: StateChannel;

    before(() => {
      // NOTE: this functionality is tested in `setup-channel.spec`
      sc = StateChannel.setupChannel(
        IdentityApp,
        { ProxyFactory, MinimumViableMultisig },
        multisigAddress,
        getChainId(),
        initiator,
        responder,
      );
      json = sc.toJson();
      rehydrated = StateChannel.fromJson(json);
    });

    it("should work", () => {
      for (const prop of Object.keys(sc)) {
        if (typeof sc[prop] === "function" || prop === "freeBalanceAppInstance") {
          // skip fns
          // free balance asserted below
          continue;
        }
        expect(rehydrated[prop]).to.deep.eq(sc[prop]);
      }
    });

    it("should have app instance maps", () => {
      expect(rehydrated.appInstances).to.deep.eq(sc.appInstances);
    });

    it("should have proposed app instance maps", () => {
      expect(rehydrated.proposedAppInstances).to.deep.eq(sc.proposedAppInstances);
    });

    it("should have a free balance app instance", () => {
      // will fail because of { _hex: "" } vs BigNumber comparison
      expect(rehydrated.freeBalance).to.deep.contain(bigNumberifyJson(sc.freeBalance));
    });

    it("should not change the user addresss", () => {
      expect(rehydrated.userIdentifiers[0]).to.eq(initiator);
      expect(rehydrated.userIdentifiers[1]).to.eq(responder);
    });

    it("should not change the multisig address", () => {
      expect(rehydrated.multisigAddress).to.eq(sc.multisigAddress);
    });
  });
});
