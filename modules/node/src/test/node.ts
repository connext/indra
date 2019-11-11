import { Node as NodeTypes } from "@counterfactual/types";

import { CLogger, JsonRpcResponse } from "../util";

import { mkAddress, mkXpub } from "./utils";

const logger = new CLogger("NodeTest");

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

export const mockNodeProvider = {
  publicIdentifier: mockNodePublicIdentifier,
  rpcRouter: {
    dispatch: (param: any): JsonRpcResponse | undefined => {
      logger.log(`Called mocked router.dispatch with params: ${JSON.stringify(param)}`);
      switch (param.methodName) {
        case NodeTypes.RpcMethodName.CREATE_CHANNEL:
          return createMockJsonRpcResponse({
            multisigAddress: mockStateDepositHolderAddress,
          } as NodeTypes.CreateChannelResult);
        case NodeTypes.RpcMethodName.GET_STATE_DEPOSIT_HOLDER_ADDRESS:
          return createMockJsonRpcResponse({
            address: mockStateDepositHolderAddress,
          } as NodeTypes.GetStateDepositHolderAddressResult);
        default:
          throw new Error(`methodName: ${param.methodName} has an undefined mock response`);
      }
    },
  },
};
