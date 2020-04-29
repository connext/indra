// import { MemoryStorage as MemoryStoreService } from "@connext/store";
// import { MultisigTransaction, Context } from "@connext/types";
// import { createRandomAddress, appIdentityToHash, getRandomChannelSigners } from "@connext/utils";
// import { utils, constants } from "ethers";
// import { TransactionDescription } from "@ethersproject/abi";

// import { generateRandomNetworkContext } from "../../../cf-core/src/testing/mocks";
// import { createAppInstanceForTest } from "../../../cf-core/src/testing/utils";

// import * as ConditionalTransactionDelegateTarget from "../build/ConditionalTransactionDelegateTarget.json";
// import { FreeBalanceClass, StateChannel } from "../../../cf-core/src/models";

// import {
//   getConditionalTransactionCommitment,
//   ConditionalTransactionCommitment,
// } from "./conditional-tx-commitment";

// describe("ConditionalTransactionCommitment", () => {
//   let tx: MultisigTransaction;
//   let commitment: ConditionalTransactionCommitment;

//   // Test network context
//   const context = { network: generateRandomNetworkContext() } as Context;

//   // signing keys
//   const [initiator, responder] = getRandomChannelSigners(2);

//   // State channel testing values
//   let stateChannel = StateChannel.setupChannel(
//     context.network.IdentityApp,
//     {
//       proxyFactory: context.network.ProxyFactory,
//       multisigMastercopy: context.network.MinimumViableMultisig,
//     },
//     utils.getAddress(createRandomAddress()),
//     initiator.publicIdentifier,
//     responder.publicIdentifier,
//   );

//   expect(stateChannel.userIdentifiers[0]).toEqual(initiator.publicIdentifier);
//   expect(stateChannel.userIdentifiers[1]).toEqual(responder.publicIdentifier);

//   // Set the state to some test values
//   stateChannel = stateChannel.setFreeBalance(
//     FreeBalanceClass.createWithFundedTokenAmounts(stateChannel.multisigOwners, constants.WeiPerEther, [
//       constants.AddressZero,
//     ]),
//   );

//   const freeBalanceETH = stateChannel.freeBalance;

//   const appInstance = createAppInstanceForTest(stateChannel);

//   beforeAll(() => {
//     commitment = getConditionalTransactionCommitment(context, stateChannel, appInstance);
//     tx = commitment.getTransactionDetails();
//   });

//   it("should be to the ConditionalTransactionDelegateTarget contract", () => {
//     expect(tx.to).toBe(context.network.ConditionalTransactionDelegateTarget);
//   });

//   it("should have no value", () => {
//     expect(tx.value).toBe(0);
//   });

//   describe("storage", () => {
//     it("should be stored correctly", async () => {
//       const store = new MemoryStoreService();
//       await store.createConditionalTransactionCommitment(commitment.appIdentityHash, commitment);
//       const retrieved = await store.getConditionalTransactionCommitment(commitment.appIdentityHash);
//       expect(retrieved).toMatchObject(commitment);
//       await commitment.addSignatures(
//         await initiator.signMessage(commitment.hashToSign()),
//         await responder.signMessage(commitment.hashToSign()),
//       );
//       await store.updateConditionalTransactionCommitment(commitment.appIdentityHash, commitment);
//       const signed = await store.getConditionalTransactionCommitment(commitment.appIdentityHash);
//       expect(signed).toMatchObject(commitment);
//     });
//   });

//   describe("the calldata", () => {
//     let iface: utils.Interface;
//     let calldata: TransactionDescription;

//     beforeAll(() => {
//       iface = new utils.Interface(ConditionalTransactionDelegateTarget.abi);
//       calldata = iface.parseTransaction({ data: tx.data });
//     });

//     it("should be directed at the executeEffectOfInterpretedAppOutcome method", () => {
//       expect(calldata.sighash).toBe(iface.getSighash(iface.getFunction("executeEffectOfInterpretedAppOutcome")));
//     });

//     it("should have correctly constructed arguments", () => {
//       const [
//         appRegistryAddress,
//         freeBalanceAppIdentity,
//         appIdentityHash,
//         interpreterAddress,
//         interpreterParams,
//       ] = calldata.args;
//       expect(appRegistryAddress).toBe(context.network.ChallengeRegistry);
//       expect(freeBalanceAppIdentity).toBe(freeBalanceETH.identityHash);
//       expect(appIdentityHash).toBe(appIdentityToHash(appInstance.identity));
//       expect(interpreterAddress).toBe(context.network.TwoPartyFixedOutcomeInterpreter);
//       expect(interpreterParams).toBe(appInstance.encodedInterpreterParams);
//     });
//   });
// });
