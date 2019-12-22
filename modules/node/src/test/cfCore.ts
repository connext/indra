import { CLogger } from "../util";
import { CFCoreTypes, JsonRpcResponse } from "../util/cfCore";

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
        case CFCoreTypes.RpcMethodNames.chan_create:
          return createMockJsonRpcResponse({
            multisigAddress: mockStateDepositHolderAddress,
          } as CFCoreTypes.CreateChannelResult);
        case CFCoreTypes.RpcMethodNames.chan_getStateDepositHolderAddress:
          return createMockJsonRpcResponse({
            address: mockStateDepositHolderAddress,
          } as CFCoreTypes.GetStateDepositHolderAddressResult);
        default:
          throw new Error(`methodName: ${param.methodName} has an undefined mock response`);
      }
    },
  },
};
