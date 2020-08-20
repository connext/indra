import { IConnextClient, AppInstanceJson } from "@connext/types";
import { getRandomIdentifier } from "@connext/utils";
// import { Client } from "ts-nats";

import {
  createClient,
  ETH_AMOUNT_MD,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
//   getNatsClient,
} from "./util";

describe("Challenges", () => {
  let client: IConnextClient;
  let app: AppInstanceJson;
  const recipient = getRandomIdentifier();

  // let nats: Client;
  // before(async () => { nats = getNatsClient(); });

  beforeEach(async () => {
    client = await createClient({ watcherEnabled: true });
    await fundChannel(client, ETH_AMOUNT_MD);

    // install an app with some value in sender channel
    const res = await client.transfer({ amount: ETH_AMOUNT_SM, recipient });
    const { appInstance } = (await client.getAppInstance(res.appIdentityHash)) || {};
    app = appInstance!;
  });

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("node should be able to initiate a dispute", async () => {
    // trigger node initiated dispute
    // wait for challenge completion event from watcher
  });

  it("client should be able to initiate a dispute", async () => {
    const { appChallenge, freeBalanceChallenge } = await client.initiateChallenge({
      appIdentityHash: app.identityHash,
    });
    expect(appChallenge.hash).to.be.ok;
    expect(freeBalanceChallenge.hash).to.be.ok;

    // wait for challenge completion event from watcher
  });

  it("node and client should be able to cooperatively cancel a dispute", async () => {
    // begin dispute
    // wait for challenge event from watcher
    // cancel the dispute
  });

  it("channel should not operate when it is in dispute (client initiated)", async () => {
    // begin dispute from client
    // try to deposit (should fail)
  });

  it("channel should not operate when it is in dispute (node initiated)", async () => {
    // begin dispute from node
    // try to deposit from client (should fail)
  });
});
