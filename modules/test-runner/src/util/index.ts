import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

export const expect = chai.expect as any;

// export from helpers dir
export * from "./helpers/asyncTransferAsset";
export * from "./helpers/fundChannel";
export * from "./helpers/requestDepositRights";
export * from "./helpers/swapAsset";
export * from "./helpers/withdrawFromChannel";

// export from current dir
export * from "./bn";
export * from "./channelProvider";
export * from "./client";
export * from "./constants";
export * from "./db";
export * from "./env";
export * from "./ethprovider";
export * from "./store";
export * from "./types";
