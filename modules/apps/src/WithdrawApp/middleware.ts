import { ProposeMiddlewareContext } from "@connext/types";
import { validateWithdrawApp } from "./validation";

export const proposeWithdrawMiddleware = async (cxt: ProposeMiddlewareContext) => {
  const { params } = cxt;
  return validateWithdrawApp(params);
};
