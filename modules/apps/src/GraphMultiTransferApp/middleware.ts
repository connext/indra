import { ProposeMiddlewareContext } from "@connext/types";
import { validateGraphMultiTransferApp } from ".";

export const proposeGraphMultiTransferMiddleware = (cxt: ProposeMiddlewareContext) => {
  const { params } = cxt;
  return validateGraphMultiTransferApp(params);
};
