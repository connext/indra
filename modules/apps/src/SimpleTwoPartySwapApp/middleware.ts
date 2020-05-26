import { ProposeMiddlewareContext } from "@connext/types";

export const proposeSwapMiddleware = (cxt: ProposeMiddlewareContext) => {
  // NOTE: the only swap app-specfic validation that happens has to do with
  // node-specific config/context. (ie is the swap supported? is it a valid
  // rate?). All proposal validation must be injected into the middleware
  // on creation of cfcore
  return;
};
