declare module "redux-logger" {
  import {Middleware} from "redux";

  export function createLogger(): Middleware
}
