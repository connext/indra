import { ProposeMiddlewareContext } from "@connext/types";
import { validateWithdrawApp } from ".";

export const proposeWithdrawMiddleware = async (cxt: ProposeMiddlewareContext) => {
  const { params } = cxt;
  return validateWithdrawApp(params);
};
