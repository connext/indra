import { ProposeMiddlewareContext } from "@connext/types";
import { validateSignedTransferApp } from ".";

export const proposeSignedTransferMiddleware = (cxt: ProposeMiddlewareContext) => {
  const { params } = cxt;
  return validateSignedTransferApp(params);
};
