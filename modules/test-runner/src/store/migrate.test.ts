import {
  STORE_SCHEMA_VERSION,
  StateChannelJSON,
  ConnextClientStorePrefix,
  FILESTORAGE,
  AppInstanceJson,
} from "@connext/types";
import { Client as DBClient } from "pg";
import { before } from "mocha";
import SQL from "sql-template-strings";
import { Client as NatsClient } from "ts-nats";

import { expect, getDbClient, connectNats, env, createClient } from "../util";
import {
  CHANNEL_KEY_VO_1,
  CHANNEL_KEY_VO_2,
  CHANNEL_KEY_VO_3,
  CHANNEL_KEY_VO_4,
  CHANNEL_VALUE_VO_1,
  CHANNEL_VALUE_VO_2,
  CHANNEL_VALUE_VO_3,
  CHANNEL_VALUE_VO_4,
  MNEMONIC_V0_1,
  MNEMONIC_V0_2,
  MNEMONIC_V0_3,
  MNEMONIC_V0_4,
  ConnextClientStorePrefixV0,
  ConnextNodeStorePrefixV0,
  XPUB_V0_1,
  XPUB_V0_2,
  XPUB_V0_3,
  XPUB_V0_4,
} from "./examples";
import { ConnextStore, FileStorage, safeJsonStringify, KeyValueStorage } from "@connext/store";

const convertV0toV1JSON = (oldChannel: any): StateChannelJSON => {
  const removeIsVirtualTag = (obj: any) => {
    const { isVirtualApp, ...ret } = obj;
    return ret;
  };
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    monotonicNumProposedApps: oldChannel.monotonicNumProposedApps,
    multisigAddress: oldChannel.multisigAddress,
    userNeuteredExtendedKeys: oldChannel.userNeuteredExtendedKeys,
    proposedAppInstances: oldChannel.proposedAppInstances || [],
    appInstances: oldChannel.appInstances
      ? oldChannel.appInstances.map(([id, appJson]) => [
          id,
          { ...removeIsVirtualTag(appJson), multisigAddress: oldChannel.multisigAddress },
        ])
      : [],
    freeBalanceAppInstance: {
      multisigAddress: oldChannel.multisigAddress,
      multiAssetMultiPartyCoinTransferInterpreterParams: null,
      singleAssetTwoPartyCoinTransferInterpreterParams: null,
      twoPartyOutcomeInterpreterParams: null,
      ...removeIsVirtualTag(oldChannel.freeBalanceAppInstance),
      appInterface: {
        ...oldChannel.freeBalanceAppInstance.appInterface,
        actionEncoding: null,
      },
    } as AppInstanceJson,
    addresses: oldChannel.addresses,
  };
};

const oldClientChannels: [string, { [k: string]: any }][] = [
  [CHANNEL_KEY_VO_1, CHANNEL_VALUE_VO_1],
  [CHANNEL_KEY_VO_2, CHANNEL_VALUE_VO_2],
  [CHANNEL_KEY_VO_3, CHANNEL_VALUE_VO_3],
  [CHANNEL_KEY_VO_4, CHANNEL_VALUE_VO_4],
];

const oldClientXpubs: string[] = [XPUB_V0_1, XPUB_V0_2, XPUB_V0_3, XPUB_V0_4];

describe("Store Migrations", () => {
  let dbClient: DBClient;
  let nats: NatsClient;

  // must have the node pub id to properly convert the keys in the tests
  const nodePubId = env.nodePubId;
  let shouldSkip = false;
  if (nodePubId === "") {
    shouldSkip = true;
  }

  const insertNodeRecords = async () => {
    // insert old channels
    for (const idx in oldClientChannels) {
      const [key, value] = oldClientChannels[idx];
      const json = value[key];
      // update prefixes + pubIds
      let nodeKey = key
        .replace(ConnextClientStorePrefixV0, ConnextNodeStorePrefixV0)
        .replace(oldClientXpubs[idx], nodePubId);
      await dbClient.query(SQL`
        INSERT INTO node_records VALUES
        (
          ${nodeKey},
          ${{ [nodeKey]: json }}
        )
      `);
      await dbClient.query(SQL`
        INSERT INTO "channel" ("userPublicIdentifier", "nodePublicIdentifier", "multisigAddress") VALUES (
          ${oldClientXpubs[idx]},
          ${nodePubId},
          ${json.multisigAddress}
        );
      `);
    }

    // make sure theyre properly inserted
    // node_records
    const { rows, rowCount } = await dbClient.query(SQL`
      SELECT * FROM node_records;
    `);
    expect(rowCount).to.eq(oldClientChannels.length);

    rows.forEach((row, idx) => {
      const [oldKey, oldVal] = oldClientChannels[idx];
      const json = oldVal[oldKey];
      const nodeKey = oldKey
        .replace(ConnextClientStorePrefixV0, ConnextNodeStorePrefixV0)
        .replace(oldClientXpubs[idx], nodePubId);
      expect(row.path).to.eq(nodeKey);
      expect(row.value).to.containSubset({ [nodeKey]: json });
    });

    // channels
    // query is safe because clears db before inserting
    const { rows: channelRows, rowCount: channelCount } = await dbClient.query(
      SQL`SELECT * FROM channel;`,
    );
    expect(channelCount).to.eq(oldClientChannels.length);
    channelRows.forEach((channelRow, idx) => {
      const [oldKey, oldVal] = oldClientChannels[idx];
      const json = oldVal[oldKey];
      // console.log(`**** channelRow: ${channelRow}`);
      expect(channelRow).to.containSubset({
        userPublicIdentifier: oldClientXpubs[idx],
        nodePublicIdentifier: nodePubId,
        multisigAddress: json.multisigAddress,
      });
    });
  };

  before(async () => {
    dbClient = getDbClient();
    nats = await connectNats();
  });

  beforeEach(async () => {
    if (shouldSkip) {
      return;
    }
    // clean table
    await dbClient.query("truncate table node_records cascade;");
    await dbClient.query("truncate table channel cascade;");
    await dbClient.query("truncate table app_instance cascade;");
    await dbClient.query("truncate table setup_commitment cascade;");

    // insert old records
    await insertNodeRecords();
  });

  it("node can migrate from v0 to v1", async () => {
    if (shouldSkip) {
      return;
    }
    const res = await nats.request(
      `admin.migrate-channel-store`,
      10000,
      JSON.stringify({ token: env.adminToken }),
    );
    expect(JSON.parse(res.data).err).to.be.null;

    for (const oldChannel of oldClientChannels) {
      const [oldKey, oldValue] = oldChannel;
      const oldJson = oldValue[oldKey];
      const expected: StateChannelJSON = convertV0toV1JSON(oldJson);
      const { data } = await nats.request(
        `admin.get-state-channel-by-multisig`,
        10000,
        JSON.stringify({
          multisigAddress: oldJson.multisigAddress,
          token: env.adminToken,
        }),
      );
      const { response: channel }: { response: StateChannelJSON } = JSON.parse(data);
      // use containSubset over deep equal to avoid
      // nulls
      expect(channel).to.containSubset(expected);
    }
  });

  it("client can migrate from v0 to v1", async () => {
    if (shouldSkip) {
      return;
    }
    // load up existing store by writing values to a file
    const fileStorage = new KeyValueStorage(new FileStorage(ConnextClientStorePrefix));
    await fileStorage.clear();
    for (const oldChannel of oldClientChannels) {
      const [oldKey, oldValue] = oldChannel;
      const oldJson = oldValue[oldKey];
      const key = `channel-${oldJson.multisigAddress}`;
      await fileStorage.setItem(key, safeJsonStringify(oldChannel));
      // sanity check
      expect(await fileStorage.getItem(key)).to.be.ok;
      expect(await fileStorage.getSchemaVersion()).to.be.eq(0);
    }

    const res = await nats.request(
      `admin.migrate-channel-store`,
      10000,
      JSON.stringify({ token: env.adminToken }),
    );
    expect(JSON.parse(res.data).err).to.be.null;
    // if above tests work, this should work

    // start up client and verify channel is correct
    const oldMnemonics = [MNEMONIC_V0_1, MNEMONIC_V0_2, MNEMONIC_V0_3, MNEMONIC_V0_4];
    for (const idx in Array(oldMnemonics.length)) {
      const client = await createClient({
        store: new ConnextStore(FILESTORAGE),
        mnemonic: oldMnemonics[idx],
      });
      expect(client).to.be.ok;
      const { data: channel } = await client.getStateChannel();
      const [oldKey, oldValue] = oldClientChannels[idx];
      const oldJson = oldValue[oldKey];
      expect(channel).to.deep.eq(convertV0toV1JSON(oldJson));
    }
    await fileStorage.clear();
  });
});
