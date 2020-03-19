import { Client as DBClient } from "pg";
import { before } from "mocha";
import {
  STORE_SCHEMA_VERSION,
  StateChannelJSON,
  ConnextClientStorePrefix,
  FILESTORAGE,
  AppInstanceJson,
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
    } as AppInstanceJson,
    addresses: oldChannel.addresses,
  };
};

const oldChannelKey1 = `INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x2360C73c3D9eB82Eb47A903E90B468277B76F409`;
const oldChannelValue1 = {
  "INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x2360C73c3D9eB82Eb47A903E90B468277B76F409": {
    multisigAddress: "0x2360C73c3D9eB82Eb47A903E90B468277B76F409",
    userNeuteredExtendedKeys: [
      "xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6",
      "xpub6F5LLcFKneAHifRSqK9ubs5qM3vLWXomJQRp39cv9Yy9bMdY54y84EuD7PJRLUw5nGxJkFBH3wQ91zV2oJh9KEnkx87G77H14CzRnNiTfen",
    ],
    appInstances: [],
    freeBalanceAppInstance: {
      participants: [
        "0xb27DFe8d9b55506cE95E406fD3fEB7e0a148c1BC",
        "0xF80fd6F5eF91230805508bB28d75248024E50F6F",
      ],
      defaultTimeout: 172800,
      appInterface: {
        addr: "0xde8d1288e2c7eC3e0b7279F8395b87A996Cc02f4",
        stateEncoding:
          "\n  tuple(\n    address[] tokenAddresses,\n    tuple(\n      address to,\n      uint256 amount\n    )[][] balances,\n    bytes32[] activeApps\n  )\n",
      },
      appSeqNo: 0,
      latestState: {
        activeApps: [],
        tokenAddresses: [
          "0x0000000000000000000000000000000000000000",
          "0xFab46E002BbF0b4509813474841E0716E6730136",
        ],
        balances: [
          [
            { to: "0xF80fd6F5eF91230805508bB28d75248024E50F6F", amount: { _hex: "0x02" } },
            { to: "0xb27DFe8d9b55506cE95E406fD3fEB7e0a148c1BC", amount: { _hex: "0x00" } },
          ],
          [
            {
              to: "0xF80fd6F5eF91230805508bB28d75248024E50F6F",
              amount: { _hex: "0x0225937a5fbc632800" },
            },
            { to: "0xb27DFe8d9b55506cE95E406fD3fEB7e0a148c1BC", amount: { _hex: "0x00" } },
          ],
        ],
      },
      latestVersionNumber: 40,
      latestTimeout: 172800,
      outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
      identityHash: "0x8d9360248535085939e0dc425553d173c629e8b6f4538904243098aa6c45c6a9",
    },
    monotonicNumProposedApps: 4,
    singleAssetTwoPartyIntermediaryAgreements: [],
    createdAt: 1569012142064,
    proxyFactoryAddress: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
    addresses: {
      proxyFactory: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
      multisigMastercopy: "0xe54f4EBeCE507477dFb86FA226394bdbA0b85d66",
    },
  },
};

const oldChannelKey2 = `INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x2E91989f15b8cB708c3206701EFe5973b105AF2B`;
const oldChannelValue2 = {
  "INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x2E91989f15b8cB708c3206701EFe5973b105AF2B": {
    multisigAddress: "0x2E91989f15b8cB708c3206701EFe5973b105AF2B",
    userNeuteredExtendedKeys: [
      "xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6",
      "xpub6DxirUuvCPEmsqXxtntaVxxF9gKrHy2PxyrYZvmCJ27ffDTmtf37zJC331ZgusyEdCcAF37LrhfebjDevFVGsUNVCJgSqbBDBcK3CGUBdL5",
    ],
    appInstances: [],
    freeBalanceAppInstance: {
      participants: [
        "0xBBab883dB428bD0c336E860052DD08694A2d991F",
        "0xF80fd6F5eF91230805508bB28d75248024E50F6F",
      ],
      defaultTimeout: 172800,
      appInterface: {
        addr: "0xde8d1288e2c7eC3e0b7279F8395b87A996Cc02f4",
        stateEncoding:
          "\n  tuple(\n    address[] tokenAddresses,\n    tuple(\n      address to,\n      uint256 amount\n    )[][] balances,\n    bytes32[] activeApps\n  )\n",
      },
      appSeqNo: 0,
      latestState: {
        activeApps: [],
        tokenAddresses: ["0x0000000000000000000000000000000000000000"],
        balances: [
          [
            { to: "0xF80fd6F5eF91230805508bB28d75248024E50F6F", amount: { _hex: "0x00" } },
            { to: "0xBBab883dB428bD0c336E860052DD08694A2d991F", amount: { _hex: "0x00" } },
          ],
        ],
      },
      latestVersionNumber: 0,
      latestTimeout: 172800,
      outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
      identityHash: "0x8557a32095de22965ba1e57f75812ef81e4e61bce5ba60fa7386d4243738e8b9",
    },
    monotonicNumProposedApps: 1,
    singleAssetTwoPartyIntermediaryAgreements: [],
    createdAt: 1569012499649,
    proxyFactoryAddress: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
    addresses: {
      proxyFactory: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
      multisigMastercopy: "0xe54f4EBeCE507477dFb86FA226394bdbA0b85d66",
    },
  },
};

describe("Store Migrations", () => {
  let dbClient: DBClient;
  let nats: NatsClient;

  before(async () => {
    dbClient = getDbClient();
    nats = await connectNats();
  });

  beforeEach(async () => {
    await dbClient.query("truncate table node_records cascade;");
    await dbClient.query("truncate table channel cascade;");
    await dbClient.query("truncate table app_instance cascade;");
    await dbClient.query("truncate table setup_commitment_entity cascade;");
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

  it("client can migrate from v0 to v1", async () => {
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
