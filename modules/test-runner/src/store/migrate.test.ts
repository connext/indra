import { Client as DBClient } from "pg";
import { before } from "mocha";
import { delay, StateChannelJSON } from "@connext/types";
import { Client as NatsClient } from "ts-nats";
import SQL from "sql-template-strings";

import { expect, getDbClient, connectNats, env } from "../util";

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
    const oldChannelKey1 =
      "INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x8C0A6Fee57539DCF1e2F8414ded4C3692742f994";
    const oldChannelValue1 = {
      "INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x8C0A6Fee57539DCF1e2F8414ded4C3692742f994": {
        multisigAddress: "0x8C0A6Fee57539DCF1e2F8414ded4C3692742f994",
        userNeuteredExtendedKeys: [
          "xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6",
          "xpub6EahuqCg3qVXgL1oh33w6gfUYrKh4gBoMacUa8oJvRpzg1inb9aZ73fS1iAP2pKrRf3pkbmTSyuybLhLhYXVVPF9VvVbgjCeaQcfi8M5qpV",
        ],
        appInstances: [],
        freeBalanceAppInstance: {
          participants: [
            "0xadFA28e08Fb7427cfE0e02b47632151FC549eDd9",
            "0xDA3CCBa9F3e3a9fE7D0Ed9F699Ca2BEF78Ba7A6c",
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
                { to: "0xadFA28e08Fb7427cfE0e02b47632151FC549eDd9", amount: { _hex: "0x00" } },
                { to: "0xDA3CCBa9F3e3a9fE7D0Ed9F699Ca2BEF78Ba7A6c", amount: { _hex: "0x00" } },
              ],
            ],
          },
          latestVersionNumber: 0,
          latestTimeout: 172800,
          outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
          identityHash: "0x278399c996e94f465e79ad006c5766b53f9cb61715943f9c35ea595ae3dd3611",
        },
        monotonicNumProposedApps: 1,
        singleAssetTwoPartyIntermediaryAgreements: [],
        createdAt: 1569188857018,
        proxyFactoryAddress: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
        addresses: {
          proxyFactory: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
          multisigMastercopy: "0xe54f4EBeCE507477dFb86FA226394bdbA0b85d66",
        },
      },
    };

    const oldChannelKey2 =
      "INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x9E746946146Da59D4d0daBfEA159ed791FB42FD1";
    const oldChannelValue2 = {
      "INDRA_NODE_CF_CORE/xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6/channel/0x9E746946146Da59D4d0daBfEA159ed791FB42FD1": {
        multisigAddress: "0x9E746946146Da59D4d0daBfEA159ed791FB42FD1",
        userNeuteredExtendedKeys: [
          "xpub6E3tjd9js7QMrBtYo7f157D7MwauL6MWdLzKekFaRBb3bvaQnUPjHKJcdNhiqSjhmwa6TcTjV1wSDTgvz52To2ZjhGMiQFbYie2N2LZpNx6",
          "xpub6E37ACnYHvmaHmkHsWrLKGc3ibkBppwhhBptWfv3dRW4t72LQtuo8eDegvqqwPtf2agT6FXJBfSHPxokbvaBqNeZS1FPkEvKjHVc77p5s9e",
        ],
        appInstances: [],
        freeBalanceAppInstance: {
          participants: [
            "0xD5f9bDb0A387F42B9109110c6fEe1864737E4274",
            "0xDA3CCBa9F3e3a9fE7D0Ed9F699Ca2BEF78Ba7A6c",
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
                { to: "0xD5f9bDb0A387F42B9109110c6fEe1864737E4274", amount: { _hex: "0x00" } },
                { to: "0xDA3CCBa9F3e3a9fE7D0Ed9F699Ca2BEF78Ba7A6c", amount: { _hex: "0x00" } },
              ],
              [
                {
                  to: "0xDA3CCBa9F3e3a9fE7D0Ed9F699Ca2BEF78Ba7A6c",
                  amount: { _hex: "0x68155a43676e0000" },
                },
                {
                  to: "0xD5f9bDb0A387F42B9109110c6fEe1864737E4274",
                  amount: { _hex: "0x22b1c8c1227a0000" },
                },
              ],
            ],
          },
          latestVersionNumber: 24,
          latestTimeout: 172800,
          outcomeType: "MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER",
          identityHash: "0xc70a8518557ac136f60c643485d96e774e54bf9a026e6e68ad6a5b15dfbc811e",
        },
        monotonicNumProposedApps: 5,
        singleAssetTwoPartyIntermediaryAgreements: [],
        createdAt: 1569070400584,
        proxyFactoryAddress: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
        addresses: {
          proxyFactory: "0x8eb543b35DE94B0E636402C7cA32947b22853eDF",
          multisigMastercopy: "0xe54f4EBeCE507477dFb86FA226394bdbA0b85d66",
        },
      },
    };

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
      const { data } = await nats.request(
        `admin.get-state-channel-by-multisig`,
        10000,
        JSON.stringify({
          multisigAddress: oldChannel.multisigAddress,
          token: env.adminToken,
        }),
      );
      const { response: channel }: { response: StateChannelJSON } = JSON.parse(data);
      console.log("channel: ", channel);
      expect(channel).to.deep.eq(oldChannel);
    }
  });
});
