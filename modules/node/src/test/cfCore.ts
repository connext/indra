import { Node as CFCoreTypes } from "@counterfactual/types";

import { CLogger } from "../util";
import { JsonRpcResponse } from "../util/cfCore";

import { mkAddress, mkXpub } from "./utils";

const logger = new CLogger("CFCoreTest");

export const mockStateDepositHolderAddress = mkAddress("0xfefe");
export const mockNodePublicIdentifier = mkXpub("xpubCONNEXTNODE");

function createMockJsonRpcResponse(result: any): JsonRpcResponse {
  return {
    id: 42,
    jsonrpc: "2.0",
    result: {
      result,
    },
  };
}

export const mockCFCoreProvider = {
  publicIdentifier: mockNodePublicIdentifier,
  rpcRouter: {
    dispatch: (param: any): JsonRpcResponse | undefined => {
      logger.log(`Called mocked router.dispatch with params: ${JSON.stringify(param)}`);
      switch (param.methodName) {
        case CFCoreTypes.RpcMethodName.CREATE_CHANNEL:
          return createMockJsonRpcResponse({
            multisigAddress: mockStateDepositHolderAddress,
          } as CFCoreTypes.CreateChannelResult);
        case CFCoreTypes.RpcMethodName.GET_STATE_DEPOSIT_HOLDER_ADDRESS:
          return createMockJsonRpcResponse({
            address: mockStateDepositHolderAddress,
          } as CFCoreTypes.GetStateDepositHolderAddressResult);
        default:
          throw new Error(`methodName: ${param.methodName} has an undefined mock response`);
      }
    },
  },
};
