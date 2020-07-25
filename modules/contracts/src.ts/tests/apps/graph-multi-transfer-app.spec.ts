import {
    CoinTransfer,
    GraphMultiTransferAppAction,
    GraphMultiTransferAppActionEncoding,
    GraphMultiTransferAppState,
    GraphMultiTransferAppStateEncoding,
    singleAssetTwoPartyCoinTransferEncoding,
    PrivateKey,
    GraphReceipt,
  } from "@connext/types";
  import {
    getTestVerifyingContract,
    getRandomBytes32,
    getAddressFromPrivateKey,
    getTestGraphReceiptToSign,
    signGraphReceiptMessage,
  } from "@connext/utils";
  import { BigNumber, Contract, ContractFactory, constants, utils } from "ethers";
  
  import { GraphMultiTransferApp } from "../../artifacts";
  
  import { expect, provider, mkAddress } from "../utils";
  
  const { HashZero, Zero } = constants;
  const { defaultAbiCoder } = utils;
  
  const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
    defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];
  
  const decodeAppState = (encodedAppState: string): GraphMultiTransferAppState =>
    defaultAbiCoder.decode([GraphMultiTransferAppStateEncoding], encodedAppState)[0];
  
  const encodeAppState = (
    state: GraphMultiTransferAppState,
    onlyCoinTransfers: boolean = false,
  ): string => {
    if (!onlyCoinTransfers)
      return defaultAbiCoder.encode([GraphMultiTransferAppStateEncoding], [state]);
    return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
  };
  
  function encodeAppAction(state: GraphMultiTransferAppAction): string {
    return defaultAbiCoder.encode([GraphMultiTransferAppActionEncoding], [state]);
  }
  
//   describe("GraphMultiTransferApp", () => {
//     let privateKey: PrivateKey;
//     let signerAddress: string;
//     let chainId: number;
//     let verifyingContract: string;
//     let receipt: GraphReceipt;
//     let goodSig: string;
//     let badSig: string;
//     let graphMultiTransferApp: Contract;
//     let senderAddr: string;
//     let receiverAddr: string;
//     let transferAmount: BigNumber;
//     let preState: GraphMultiTransferAppState;
//     let paymentId: string;
  
//     async function computeOutcome(state: GraphMultiTransferAppState): Promise<string> {
//       return graphMultiTransferApp.computeOutcome(encodeAppState(state));
//     }
  
//     async function applyAction(
//       state: GraphMultiTransferAppState,
//       action: GraphMultiTransferAppAction,
//     ): Promise<string> {
//       return graphMultiTransferApp.applyAction(encodeAppState(state), encodeAppAction(action));
//     }
  
//     async function validateOutcome(encodedTransfers: string, postState: GraphMultiTransferAppState) {
//       const decoded = decodeTransfers(encodedTransfers);
//       expect(encodedTransfers).to.eq(encodeAppState(postState, true));
//       expect(decoded[0].to).eq(postState.coinTransfers[0].to);
//       expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
//       expect(decoded[1].to).eq(postState.coinTransfers[1].to);
//       expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
//     }
  
//     beforeEach(async () => {
//       const wallet = provider.getWallets()[0];
//       graphMultiTransferApp = await new ContractFactory(
//         GraphMultiTransferApp.abi,
//         GraphMultiTransferApp.bytecode,
//         wallet,
//       ).deploy();
  
//       privateKey = wallet.privateKey;
//       signerAddress = getAddressFromPrivateKey(privateKey);
  
//       chainId = (await wallet.provider.getNetwork()).chainId;
//       receipt = getTestGraphReceiptToSign();
//       verifyingContract = getTestVerifyingContract();
//       goodSig = await signGraphReceiptMessage(receipt, chainId, verifyingContract, privateKey);
//       badSig = getRandomBytes32();
//       paymentId = getRandomBytes32();
  
//       senderAddr = mkAddress("0xa");
//       receiverAddr = mkAddress("0xB");
//       transferAmount = BigNumber.from(10000);
//       preState = {
//         coinTransfers: [
//           {
//             amount: transferAmount,
//             to: senderAddr,
//           },
//           {
//             amount: Zero,
//             to: receiverAddr,
//           },
//         ],
//         finalized: false,
//         paymentId,
//         signerAddress,
//         chainId,
//         verifyingContract,
//         requestCID: receipt.requestCID,
//         subgraphDeploymentID: receipt.subgraphDeploymentID,
//       };
//     });
  
//     describe("update state", () => {
//       it("will redeem a payment with correct signature", async () => {
//         const action: GraphMultiTransferAppAction = {
//           ...receipt,
//           signature: goodSig,
//         };
  
//         let ret = await applyAction(preState, action);
//         const afterActionState = decodeAppState(ret);
  
//         const expectedPostState: GraphMultiTransferAppState = {
//           coinTransfers: [
//             {
//               amount: Zero,
//               to: senderAddr,
//             },
//             {
//               amount: transferAmount,
//               to: receiverAddr,
//             },
//           ],
//           paymentId,
//           signerAddress,
//           chainId,
//           verifyingContract,
//           requestCID: receipt.requestCID,
//           subgraphDeploymentID: receipt.subgraphDeploymentID,
//           finalized: true,
//         };
  
//         expect(afterActionState.finalized).to.eq(expectedPostState.finalized);
//         expect(afterActionState.coinTransfers[0].amount).to.eq(
//           expectedPostState.coinTransfers[0].amount,
//         );
//         expect(afterActionState.coinTransfers[1].amount).to.eq(
//           expectedPostState.coinTransfers[1].amount,
//         );
  
//         ret = await computeOutcome(afterActionState);
//         validateOutcome(ret, expectedPostState);
//       });
  
//       it("will cancel a payment if an empty action is given", async () => {
//         const action: GraphMultiTransferAppAction = {
//           ...receipt,
//           responseCID: HashZero,
//           signature: goodSig,
//         };
  
//         let ret = await applyAction(preState, action);
//         const afterActionState = decodeAppState(ret);
  
//         const expectedPostState: GraphMultiTransferAppState = {
//           coinTransfers: [
//             {
//               amount: transferAmount,
//               to: senderAddr,
//             },
//             {
//               amount: Zero,
//               to: receiverAddr,
//             },
//           ],
//           paymentId,
//           signerAddress,
//           chainId,
//           verifyingContract,
//           requestCID: receipt.requestCID,
//           subgraphDeploymentID: receipt.subgraphDeploymentID,
//           finalized: true,
//         };
  
//         expect(afterActionState.finalized).to.eq(expectedPostState.finalized);
//         expect(afterActionState.coinTransfers[0].amount).to.eq(
//           expectedPostState.coinTransfers[0].amount,
//         );
//         expect(afterActionState.coinTransfers[1].amount).to.eq(
//           expectedPostState.coinTransfers[1].amount,
//         );
  
//         ret = await computeOutcome(afterActionState);
//         validateOutcome(ret, expectedPostState);
//       });
  
//       it("will revert action with incorrect signature", async () => {
//         const action: GraphMultiTransferAppAction = {
//           ...receipt,
//           signature: badSig,
//         };
  
//         await expect(applyAction(preState, action)).revertedWith(
//           "revert ECDSA: invalid signature length",
//         );
//       });
  
//       it("will revert action if already finalized", async () => {
//         const action: GraphMultiTransferAppAction = {
//           ...receipt,
//           signature: goodSig,
//         };
//         preState.finalized = true;
  
//         await expect(applyAction(preState, action)).revertedWith(
//           "Cannot take action on finalized state",
//         );
//       });
//     });
//   });
  