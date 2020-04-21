import { ConnextStore } from "@connext/store";
import { MultisigTransaction, StoreTypes } from "@connext/types";
import { getRandomAddress } from "@connext/utils";
import { WeiPerEther, AddressZero } from "ethers/constants";
import { getAddress, Interface, TransactionDescription } from "ethers/utils";

import { generateRandomNetworkContext } from "../testing/mocks";
import { createAppInstanceForTest } from "../testing/utils";

import { ConditionalTransactionDelegateTarget } from "../contracts";
import { FreeBalanceClass, StateChannel } from "../models";
import { Context } from "../types";
import { appIdentityToHash } from "../utils";

import {
  getConditionalTransactionCommitment,
  ConditionalTransactionCommitment,
} from "./conditional-tx-commitment";
import { getRandomChannelSigners } from "../testing/random-signing-keys";

describe("ConditionalTransactionCommitment", () => {
  let tx: MultisigTransaction;
  let commitment: ConditionalTransactionCommitment;

  // Test network context
  const context = { network: generateRandomNetworkContext() } as Context;

  // signing keys
  const [initiator, responder] = getRandomChannelSigners(2);

  // State channel testing values
  let stateChannel = StateChannel.setupChannel(
    context.network.IdentityApp,
    {
      proxyFactory: context.network.ProxyFactory,
      multisigMastercopy: context.network.MinimumViableMultisig,
    },
    getAddress(getRandomAddress()),
    initiator.publicIdentifier,
    responder.publicIdentifier,
  );

  expect(stateChannel.userIdentifiers[0]).toEqual(
    initiator.publicIdentifier,
  );
  expect(stateChannel.userIdentifiers[1]).toEqual(
    responder.publicIdentifier,
  );

  // Set the state to some test values
  stateChannel = stateChannel.setFreeBalance(
    FreeBalanceClass.createWithFundedTokenAmounts(stateChannel.multisigOwners, WeiPerEther, [
      AddressZero,
    ]),
  );

  const freeBalanceETH = stateChannel.freeBalance;

  const appInstance = createAppInstanceForTest(stateChannel);

  beforeAll(() => {
    commitment = getConditionalTransactionCommitment(context, stateChannel, appInstance);
    tx = commitment.getTransactionDetails();
  });

  it("should be to the ConditionalTransactionDelegateTarget contract", () => {
    expect(tx.to).toBe(context.network.ConditionalTransactionDelegateTarget);
  });

  it("should have no value", () => {
    expect(tx.value).toBe(0);
  });

  describe("the calldata", () => {
    let iface: Interface;
    let calldata: TransactionDescription;

    beforeAll(() => {
      iface = new Interface(ConditionalTransactionDelegateTarget.abi);
      calldata = iface.parseTransaction({ data: tx.data });
    });

    it("should be directed at the executeEffectOfInterpretedAppOutcome method", () => {
      expect(calldata.sighash).toBe(iface.functions.executeEffectOfInterpretedAppOutcome.sighash);
    });

    it("should have correctly constructed arguments", () => {
      const [
        appRegistryAddress,
        freeBalanceAppIdentity,
        appIdentityHash,
        interpreterAddress,
        interpreterParams,
      ] = calldata.args;
      expect(appRegistryAddress).toBe(context.network.ChallengeRegistry);
      expect(freeBalanceAppIdentity).toBe(freeBalanceETH.identityHash);
      expect(appIdentityHash).toBe(appIdentityToHash(appInstance.identity));
      expect(interpreterAddress).toBe(context.network.TwoPartyFixedOutcomeInterpreter);
      expect(interpreterParams).toBe(appInstance.encodedInterpreterParams);
    });
  });
});
