import { ProposeMiddlewareContext } from "@connext/types";
import { validateSimpleLinkedTransferApp } from "./validation";

export const proposeLinkedTransferMiddleware = (cxt: ProposeMiddlewareContext) => {
  const { params } = cxt;
  return validateSimpleLinkedTransferApp(params);
};
