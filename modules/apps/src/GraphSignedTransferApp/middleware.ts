import { ProposeMiddlewareContext } from "@connext/types";
import { validateGraphSignedTransferApp } from "./validation";

export const proposeGraphSignedTransferMiddleware = (cxt: ProposeMiddlewareContext) => {
  const { params } = cxt;
  return validateGraphSignedTransferApp(params);
};
