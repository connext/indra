import { IConnextClient, RebalanceProfile } from "@connext/types";
import { toBN } from "@connext/utils";
import { constants } from "ethers";
import { before } from "mocha";
import { Client } from "ts-nats";

import {
  addRebalanceProfile,
  createClient,
  expect,
  getNatsClient,
  getTestLoggers,
} from "../util";

const { AddressZero } = constants;

const name = "Collateralization Profiles";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let client: IConnextClient;
  let nats: Client;
  let start: number;

  before(async () => {
    nats = getNatsClient();
  });

  beforeEach(async () => {
    start = Date.now();
    client = await createClient();
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("throws error if collateral targets are higher than reclaim", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      collateralizeThreshold: toBN("16"),
      target: toBN("10"),
      reclaimThreshold: toBN("15"),
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Rebalancing targets not properly configured/);
    timeElapsed("beforeEach + test complete", start);
  });

  it("throws error if collateralize upper bound is lower than higher bound", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      collateralizeThreshold: toBN("2"),
      target: toBN("1"),
      reclaimThreshold: toBN("9"),
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Rebalancing targets not properly configured/);
    timeElapsed("beforeEach + test complete", start);
  });

  it("throws error if reclaim upper bound is lower than higher bound", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      collateralizeThreshold: toBN("1"),
      target: toBN("10"),
      reclaimThreshold: toBN("9"),
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Rebalancing targets not properly configured/);
    timeElapsed("beforeEach + test complete", start);
  });
});
