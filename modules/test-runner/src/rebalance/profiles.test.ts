import { xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, RebalanceProfile } from "@connext/types";
import { before } from "mocha";

import { createClient, expect } from "../util";
import { connectNats } from "../util/nats";
import { Client } from "ts-nats";
import { AddressZero } from "ethers/constants";
import { addRebalanceProfile } from "../util/helpers/rebalanceProfile";

describe("Reclaim", () => {
  let client: IConnextClient;
  let nats: Client;

  before(async () => {
    nats = await connectNats();
  });

  beforeEach(async () => {
    client = await createClient();
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("throws error if collateral targets are higher than reclaim", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      lowerBoundCollateralize: "1",
      upperBoundCollateralize: "10",
      lowerBoundReclaim: "9",
      upperBoundReclaim: "15",
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Reclaim targets cannot be less than collateralize targets/);
  });

  it("throws error if collateralize upper bound is lower than higher bound", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      lowerBoundCollateralize: "10",
      upperBoundCollateralize: "1",
      lowerBoundReclaim: "9",
      upperBoundReclaim: "15",
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Rebalancing targets not properly configured/);
  });

  it("throws error if reclaim upper bound is lower than higher bound", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      lowerBoundCollateralize: "1",
      upperBoundCollateralize: "10",
      lowerBoundReclaim: "15",
      upperBoundReclaim: "9",
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Rebalancing targets not properly configured/);
  });
});
