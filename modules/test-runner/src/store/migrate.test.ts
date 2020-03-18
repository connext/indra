import { Client as DBClient } from "pg";
import { before } from "mocha";
import { STORE_SCHEMA_VERSION, StateChannelJSON } from "@connext/types";
import { Client as NatsClient } from "ts-nats";
import SQL from "sql-template-strings";

import { expect, getDbClient, connectNats, env } from "../util";
import {
  CHANNEL_VALUE_VO_2,
  CHANNEL_KEY_VO_2,
  CHANNEL_VALUE_VO_1,
  CHANNEL_KEY_VO_1,
} from "./examples";

describe("Store Migrations", () => {
  let dbClient: DBClient;
  let nats: NatsClient;

  before(async () => {
    dbClient = getDbClient();
    nats = await connectNats();
  });

  beforeEach(async () => {
    await dbClient.query("truncate table node_records cascade;");
  });

  it("node can migrate from v0 to v1", async () => {
    const oldChannelKey1 = CHANNEL_KEY_VO_1;
    const oldChannelValue1 = CHANNEL_VALUE_VO_1;

    const oldChannelKey2 = CHANNEL_KEY_VO_2;
    const oldChannelValue2 = CHANNEL_VALUE_VO_2;

    // insert old records
    await dbClient.query(SQL`
      INSERT INTO node_records VALUES
      (
        ${oldChannelKey1},
        ${oldChannelValue1}
      ), 
      (
        ${oldChannelKey2},
        ${oldChannelValue2}
      )
    `);

    const res = await nats.request(
      `admin.migrate-channel-store`,
      10000,
      JSON.stringify({ token: env.adminToken }),
    );
    expect(JSON.parse(res.data).err).to.be.null;

    for (const oldChannel of [oldChannelValue1[oldChannelKey1], oldChannelValue2[oldChannelKey2]]) {
      const expected: StateChannelJSON = {
        schemaVersion: STORE_SCHEMA_VERSION,
        monotonicNumProposedApps: oldChannel.monotonicNumProposedApps,
        multisigAddress: oldChannel.multisigAddress,
        userNeuteredExtendedKeys: oldChannel.userNeuteredExtendedKeys,
        proposedAppInstances: (oldChannel as any).proposedAppInstances || [],
        appInstances: oldChannel.appInstances,
        freeBalanceAppInstance: {
          multisigAddress: oldChannel.multisigAddress,
          multiAssetMultiPartyCoinTransferInterpreterParams: null,
          singleAssetTwoPartyCoinTransferInterpreterParams: null,
          twoPartyOutcomeInterpreterParams: null,
          ...oldChannel.freeBalanceAppInstance,
          appInterface: {
            ...oldChannel.freeBalanceAppInstance.appInterface,
            actionEncoding: null,
          },
        } as any,
        addresses: oldChannel.addresses,
      };
      const { data } = await nats.request(
        `admin.get-state-channel-by-multisig`,
        10000,
        JSON.stringify({
          multisigAddress: oldChannel.multisigAddress,
          token: env.adminToken,
        }),
      );
      const { response: channel }: { response: StateChannelJSON } = JSON.parse(data);
      expect(channel).to.deep.eq(expected);
    }
  });
});
