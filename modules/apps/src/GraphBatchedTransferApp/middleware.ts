import { ProposeMiddlewareContext } from "@connext/types";
import { validateGraphBatchedTransferApp } from ".";

export const proposeGraphBatchedTransferMiddleware = (cxt: ProposeMiddlewareContext) => {
  const { params } = cxt;
  return validateGraphBatchedTransferApp(params);
};
