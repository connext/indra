import { ProposeMiddlewareContext, JsonRpcProvider } from "@connext/types";
import { validateHashLockTransferApp } from ".";

export const proposeHashLockTransferMiddleware = async (
  cxt: ProposeMiddlewareContext,
  provider: JsonRpcProvider,
) => {
  const { params } = cxt;
  const blockNumber = await provider.getBlockNumber();
  return validateHashLockTransferApp(params, blockNumber);
};
