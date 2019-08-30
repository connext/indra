import { Node } from "@counterfactual/types";
import "reflect-metadata";
import { Connection, ConnectionManager, ConnectionOptions } from "typeorm";

import { initialMigration1567091591712 } from "../../migrations/1567091591712-initialMigration";
import { NodeRecord } from "../node/node.entity";

type StringKeyValue = { [key: string]: StringKeyValue };

export const POSTGRES_CONFIGURATION_ENV_KEYS = {
  database: "POSTGRES_DATABASE",
  host: "POSTGRES_HOST",
  password: "POSTGRES_PASSWORD",
  port: "POSTGRES_PORT",
  username: "POSTGRES_USER",
};

export type PostgresConnectionOptions = ConnectionOptions & {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
};

export const EMPTY_POSTGRES_CONFIG: ConnectionOptions = {
  database: "",
  host: "",
  password: "",
  port: 0,
  type: "postgres",
  username: "",
};

export class PostgresServiceFactory implements Node.ServiceFactory {
  private readonly connectionManager: ConnectionManager;
  private readonly connection: Connection;

  constructor(
    readonly configuration: PostgresConnectionOptions & { isDevMode: boolean },
    readonly tableName: string = "node_records",
  ) {
    this.connectionManager = new ConnectionManager();
    // TODO: use src/database/service for the db connection instead of creating a new one
    // Accomplish this by rewriting this module as a nestJs/typeorm repository
    this.connection = this.connectionManager.create({
      ...EMPTY_POSTGRES_CONFIG,
      ...configuration,
      entities: [NodeRecord],
      migrations: [initialMigration1567091591712],
      migrationsRun: !configuration.isDevMode,
      synchronize: configuration.isDevMode,
    } as ConnectionOptions);
  }

  async connectDb(): Promise<Connection> {
    await this.connection.connect();
    return this.connection;
  }

  createStoreService(storeServiceKey: string): Node.IStoreService {
    return new PostgresStoreService(this.connectionManager, storeServiceKey);
  }
}

export class PostgresStoreService implements Node.IStoreService {
  constructor(
    private readonly connectionMgr: ConnectionManager,
    private readonly storeServiceKey: string,
  ) {}

  async reset(): Promise<void> {
    const connection = this.connectionMgr.get();
    await connection.dropDatabase();
  }

  async set(pairs: { path: string; value: any }[]): Promise<void> {
    const connection = this.connectionMgr.get();

    await connection.transaction(
      async (transactionalEntityManager: any): Promise<any> => {
        for (const pair of pairs) {
          const storeKey = `${this.storeServiceKey}_${pair.path}`;
          // Wrapping the value into an object is necessary for Postgres bc the JSON column breaks
          // if you use anything other than JSON (i.e. a raw string).
          // In some cases, the node code is inserting strings as values instead of objects.
          const storeValue = { [pair.path]: pair.value };
          let record = await transactionalEntityManager.findOne(NodeRecord, storeKey);
          if (!record) {
            record = new NodeRecord();
            record.key = storeKey;
          }
          record.value = storeValue;
          await transactionalEntityManager.save(record);
        }
      },
    );
  }

  async get(path: string): Promise<StringKeyValue | string | undefined> {
    const storeKey = `${this.storeServiceKey}_${path}`;

    let res;
    // FIXME: this queries for all channels or proposed app instances, which
    // are nested under the respective keywords, hence the 'like' keyword
    // Action item: this hack won't be needed when a more robust schema around
    // node records is implemented
    if (path.endsWith("channel") || path.endsWith("appInstanceIdToProposedAppInstance")) {
      res = await this.connectionMgr
        .get()
        .manager.getRepository(NodeRecord)
        .createQueryBuilder("record")
        .where("record.key like :key", { key: `%${storeKey}%` })
        .getMany();

      const nestedRecords = res.map((record: NodeRecord) => {
        const existingKey = Object.keys(record.value)[0];
        const leafKey = existingKey.split("/").pop()!;
        const nestedValue = record.value[existingKey];
        delete record.value[existingKey];
        record.value[leafKey] = nestedValue;
        return record.value;
      });

      const records = {};

      nestedRecords.forEach((record: any): void => {
        const key = Object.keys(record)[0];
        const value = Object.values(record)[0];
        // FIXME: the store implementation (firebase) that the node used in the
        // very first implementation of the store assumed that values which are
        // null wouldn't contain key entries in the returned object so we have to
        // explicitly remove these when Postgres correctly returns even null values
        if (value !== null) {
          records[key] = value;
        }
      });

      return records;
    }

    res = await this.connectionMgr.get().manager.findOne(NodeRecord, storeKey);
    if (!res) {
      return undefined;
    }

    return res.value[path];
  }
}

export function confirmPostgresConfigurationEnvVars(): void {
  for (const [key, value] of Object.entries(POSTGRES_CONFIGURATION_ENV_KEYS)) {
    if (!process.env[value]) {
      throw new Error(
        `Postgres ${key} is not set via env var ${POSTGRES_CONFIGURATION_ENV_KEYS[key]}`,
      );
    }
  }
}
