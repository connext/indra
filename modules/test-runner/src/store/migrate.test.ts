import { Client as DBClient } from "pg";
import { before } from "mocha";
import {
  STORE_SCHEMA_VERSION,
  StateChannelJSON,
  ConnextClientStorePrefix,
  FILESTORAGE,
} from "@connext/types";
import { Client as NatsClient } from "ts-nats";
import SQL from "sql-template-strings";

import { expect, getDbClient, connectNats, env, createClient } from "../util";
import {
  CHANNEL_VALUE_VO_2,
  CHANNEL_KEY_VO_2,
  CHANNEL_VALUE_VO_1,
  CHANNEL_KEY_VO_1,
  MNEMONIC_V0_1,
  MNEMONIC_V0_2,
} from "./examples";
import { ConnextStore, FileStorage, safeJsonStringify, KeyValueStorage } from "@connext/store";

describe("Store Migrations", () => {
  let dbClient: DBClient;
  let nats: NatsClient;

  const convertV0toV1JSON = (oldChannel: any): StateChannelJSON => {
    return {
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
  };

  const oldChannelKey1 = CHANNEL_KEY_VO_1;
  const oldChannelValue1 = CHANNEL_VALUE_VO_1;

  const oldChannelKey2 = CHANNEL_KEY_VO_2;
  const oldChannelValue2 = CHANNEL_VALUE_VO_2;

  before(async () => {
    dbClient = getDbClient();
    nats = await connectNats();
  });

  beforeEach(async () => {
    await dbClient.query("truncate table node_records cascade;");
  });

  it("node can migrate from v0 to v1", async () => {
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
      const expected: StateChannelJSON = convertV0toV1JSON(oldChannel);
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

  it.only("client can migrate from v0 to v1", async () => {
    // load up existing store by writing values to a file
    const fileStorage = new KeyValueStorage(new FileStorage(ConnextClientStorePrefix));
    await fileStorage.clear();
    const oldChannels = [oldChannelValue1[oldChannelKey1], oldChannelValue2[oldChannelKey2]];
    for (const oldChannel of oldChannels) {
      const key = `channel-${oldChannel.multisigAddress}`;
      await fileStorage.setItem(key, safeJsonStringify(oldChannel));
      // sanity check
      expect(await fileStorage.getItem(key)).to.be.ok;
      expect(await fileStorage.getSchemaVersion()).to.be.eq(0);
    }
    // make sure channel has propserly migrated data in node
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
    // if above tests work, this should work

    // start up client and verify channel is correct
    const oldMnemonics = [MNEMONIC_V0_1, MNEMONIC_V0_2];
    for (const idx in Array(2)) {
      const client = await createClient({
        store: new ConnextStore(FILESTORAGE),
        mnemonic: oldMnemonics[idx],
      });
      expect(client).to.be.ok;
      console.log(`client multisig: ${client.multisigAddress}`);
      const { data: channel } = await client.getStateChannel();
      console.log(`retrieved channel after starting!!!`);
      expect(channel).to.deep.eq(convertV0toV1JSON(oldChannels[idx]));
    }
    await fileStorage.clear();
  });
});
