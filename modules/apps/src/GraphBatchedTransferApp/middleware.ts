import { ProposeMiddlewareContext, Address } from "@connext/types";
import { validateGraphBatchedTransferApp } from "./validation";

export const proposeGraphBatchedTransferMiddleware = (
  cxt: ProposeMiddlewareContext,
  getSwapRate: (fromTokenAddress: Address, toTokenAddress: Address) => Promise<string>,
): Promise<void> => {
  const { params } = cxt;
  return validateGraphBatchedTransferApp(params, getSwapRate);
};
