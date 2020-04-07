import { signChannelMessage } from "@connext/crypto";
import { MemoryStorage as MemoryStoreService } from "@connext/store";
import {
  createRandomAddress,
  createRandom32ByteHexString,
  MultisigTransaction,
} from "@connext/types";
import { WeiPerEther } from "ethers/constants";
import { getAddress, Interface, TransactionDescription } from "ethers/utils";

import { getRandomExtendedPubKey, getRandomHDNodes } from "../testing/random-signing-keys";
import { generateRandomNetworkContext } from "../testing/mocks";
import { createAppInstanceForTest } from "../testing/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../constants";
import { ConditionalTransactionDelegateTarget } from "../contracts";
import { FreeBalanceClass, StateChannel } from "../models";
import { Context } from "../types";
import { appIdentityToHash } from "../utils";

import {
  getConditionalTransactionCommitment,
  ConditionalTransactionCommitment,
} from "./conditional-tx-commitment";

describe("ConditionalTransactionCommitment", () => {
  let tx: MultisigTransaction;
  let commitment: ConditionalTransactionCommitment;

  // Test network context
  const context = { network: generateRandomNetworkContext() } as Context;

  // signing keys
  const hdNodes = getRandomHDNodes(2);

  // General interaction testing values
  const interaction = {
    sender: getRandomExtendedPubKey(),
    receiver: getRandomExtendedPubKey(),
  };

  // State channel testing values
  let stateChannel = StateChannel.setupChannel(
    context.network.IdentityApp,
    {
      proxyFactory: context.network.ProxyFactory,
      multisigMastercopy: context.network.MinimumViableMultisig,
    },
    getAddress(createRandomAddress()),
    [interaction.sender, interaction.receiver],
  );

  // Set the state to some test values
  stateChannel = stateChannel.setFreeBalance(
    FreeBalanceClass.createWithFundedTokenAmounts(stateChannel.multisigOwners, WeiPerEther, [
      CONVENTION_FOR_ETH_TOKEN_ADDRESS,
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

  describe("storage", () => {
    it("should be stored correctly", async () => {
      const store = new MemoryStoreService();
      await store.createConditionalTransactionCommitment(commitment.appIdentityHash, commitment);
      const retrieved = await store.getConditionalTransactionCommitment(commitment.appIdentityHash);
      expect(retrieved).toMatchObject(commitment);
      const hash = createRandom32ByteHexString();
      commitment.signatures = [
        await signChannelMessage(hdNodes[0].privateKey, hash),
        await signChannelMessage(hdNodes[1].privateKey, hash),
      ];
      await store.updateConditionalTransactionCommitment(commitment.appIdentityHash, commitment);
      const signed = await store.getConditionalTransactionCommitment(commitment.appIdentityHash);
      expect(signed).toMatchObject(commitment);
    });
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
