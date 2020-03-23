<<<<<<< HEAD
import { IConnextClient, RebalanceProfile, toBN } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { before, after } from "mocha";
import { Client } from "ts-nats";

import { createClient, expect } from "../util";
import { connectNats, closeNats } from "../util/nats";
=======
import { IConnextClient, RebalanceProfile } from "@connext/types";
import { before } from "mocha";

import { createClient, expect } from "../util";
import { getNatsClient } from "../util/nats";
import { Client } from "ts-nats";
import { AddressZero } from "ethers/constants";
>>>>>>> nats-messaging-refactor
import { addRebalanceProfile } from "../util/helpers/rebalanceProfile";

describe("Reclaim", () => {
  let client: IConnextClient;
  let nats: Client;

  before(async () => {
    nats = getNatsClient();
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
      lowerBoundCollateralize: toBN("1"),
      upperBoundCollateralize: toBN("10"),
      lowerBoundReclaim: toBN("9"),
      upperBoundReclaim: toBN("15"),
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Reclaim targets cannot be less than collateralize targets/);
  });

  it("throws error if collateralize upper bound is lower than higher bound", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      lowerBoundCollateralize: toBN("10"),
      upperBoundCollateralize: toBN("1"),
      lowerBoundReclaim: toBN("9"),
      upperBoundReclaim: toBN("15"),
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Rebalancing targets not properly configured/);
  });

  it("throws error if reclaim upper bound is lower than higher bound", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      lowerBoundCollateralize: toBN("1"),
      upperBoundCollateralize: toBN("10"),
      lowerBoundReclaim: toBN("15"),
      upperBoundReclaim: toBN("9"),
    };
    const profileResponse = await addRebalanceProfile(nats, client, REBALANCE_PROFILE, false);
    expect(profileResponse).to.match(/Rebalancing targets not properly configured/);
  });
});
