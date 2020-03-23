import { MemoryStorage as MemoryStoreService } from "@connext/store";
import { AddressZero, HashZero, WeiPerEther } from "ethers/constants";
import {
  getAddress,
  hexlify,
  Interface,
  randomBytes,
  TransactionDescription,
  SigningKey,
} from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../../src/constants";
import { appIdentityToHash, ConditionalTransactionCommitment } from "../../../../src/ethereum";
import { MultisigTransaction } from "../../../../src/types";
import { StateChannel } from "../../../../src/models";
import { FreeBalanceClass } from "../../../../src/models/free-balance";
import { ConditionalTransactionDelegateTarget } from "../../../contracts";
import { createAppInstanceForTest } from "../../../unit/utils";
import { getRandomExtendedPubKey, getRandomHDNodes } from "../../integration/random-signing-keys";
import { generateRandomNetworkContext } from "../../mocks";
import { Store } from "../../../../src/store";

describe("ConditionalTransactionCommitment", () => {
  let tx: MultisigTransaction;
  let commitment: ConditionalTransactionCommitment;

  // Test network context
  const networkContext = generateRandomNetworkContext();

  // signing keys
  const hdNodes = getRandomHDNodes(2);

  // General interaction testing values
  const interaction = {
    sender: getRandomExtendedPubKey(),
    receiver: getRandomExtendedPubKey(),
  };

  // State channel testing values
  let stateChannel = StateChannel.setupChannel(
    networkContext.IdentityApp,
    {
      proxyFactory: networkContext.ProxyFactory,
      multisigMastercopy: networkContext.MinimumViableMultisig,
    },
    getAddress(hexlify(randomBytes(20))),
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
    commitment = new ConditionalTransactionCommitment(
      networkContext,
      stateChannel.multisigAddress,
      stateChannel.multisigOwners,
      appInstance.identityHash,
      freeBalanceETH.identityHash,
      AddressZero,
      HashZero,
    );
    tx = commitment.getTransactionDetails();
  });

  it("should be to the ConditionalTransactionDelegateTarget contract", () => {
    expect(tx.to).toBe(networkContext.ConditionalTransactionDelegateTarget);
  });

  it("should have no value", () => {
    expect(tx.value).toBe(0);
  });

  describe("storage", () => {
    it("should be stored correctly", async () => {
      const store = new Store(new MemoryStoreService());
      await store.saveConditionalTransactionCommitment(commitment.appIdentityHash, commitment);
      const retrieved = await store.getConditionalTransactionCommitment(commitment.appIdentityHash);
      expect(retrieved).toMatchObject(commitment);
      commitment.signatures = [
        new SigningKey(hdNodes[0]).signDigest(randomBytes(20)),
        new SigningKey(hdNodes[1]).signDigest(randomBytes(20)),
      ];
      await store.saveConditionalTransactionCommitment(commitment.appIdentityHash, commitment);
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
      expect(appRegistryAddress).toBe(networkContext.ChallengeRegistry);
      expect(freeBalanceAppIdentity).toBe(freeBalanceETH.identityHash);
      expect(appIdentityHash).toBe(appIdentityToHash(appInstance.identity));
      expect(interpreterAddress).toBe(AddressZero);
      expect(interpreterParams).toBe(HashZero);
    });
  });
});
