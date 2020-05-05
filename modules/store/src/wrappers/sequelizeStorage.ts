import { DataTypes, Model, Op, Sequelize } from "sequelize";
import { mkdirSync } from "fs";
import { dirname } from "path";

import { storeDefaults } from "../constants";
import { WrappedStorage } from "../types";

class ConnextClientData extends Model {
  public key!: string;
  public value!: JSON;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

type SupportedDialects = "postgres" | "sqlite";

const getConnextClientDataInitParams = (dialect: SupportedDialects) => {
  let valueDataType = DataTypes.JSON;
  if (dialect === "postgres") {
    valueDataType = DataTypes.JSONB;
  } else if (dialect === "sqlite") {
  } else {
    throw new Error(`Unsupported database dialect: ${dialect}`);
  }
  return {
    key: {
      type: new DataTypes.STRING(1024),
      primaryKey: true,
    },
    value: {
      type: valueDataType,
    },
  };
};

export class WrappedSequelizeStorage implements WrappedStorage {
  public sequelize: Sequelize;
  constructor(
    private readonly prefix: string = storeDefaults.PREFIX,
    private readonly separator: string = storeDefaults.SEPARATOR,
    private readonly tableName: string = storeDefaults.DATABASE_TABLE_NAME,
    sequelize?: Sequelize,
    private readonly connectionUri?: string,
    private readonly dialect: SupportedDialects = "sqlite",
    private readonly sqliteStorage: string = storeDefaults.SQLITE_MEMORY_STORE_STRING,
    private readonly database: string = storeDefaults.DATABASE_NAME,
    private readonly username: string = storeDefaults.DATABASE_USERNAME,
    private readonly password: string = storeDefaults.DATABASE_PASSWORD,
  ) {
    if (sequelize) {
      this.sequelize = sequelize;
    } else if (this.connectionUri) {
      this.sequelize = new Sequelize(this.connectionUri, { logging: false });
    } else {
      if (this.sqliteStorage !== storeDefaults.SQLITE_MEMORY_STORE_STRING) {
        const dir = dirname(this.sqliteStorage);
        mkdirSync(dir, { recursive: true });
      }
      this.sequelize = new Sequelize(this.database, this.username, this.password, {
        dialect: this.dialect,
        storage: this.sqliteStorage,
        logging: false,
      });
    }
    ConnextClientData.init(
      getConnextClientDataInitParams(this.sequelize.getDialect() as SupportedDialects),
      {
        sequelize: this.sequelize,
        tableName: this.tableName,
      },
    );
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const item = await ConnextClientData.findByPk(`${this.prefix}${this.separator}${key}`);
    return item && (item.value as any);
  }

  async setItem(key: string, value: any): Promise<void> {
    await ConnextClientData.upsert({
      key: `${this.prefix}${this.separator}${key}`,
      value,
    });
  }

  async removeItem(key: string): Promise<void> {
    await ConnextClientData.destroy({
      where: {
        key: `${this.prefix}${this.separator}${key}`,
      },
    });
  }

  async getKeys(): Promise<string[]> {
    const relevantItems = await this.getRelevantItems();
    return relevantItems.map(
      (item: ConnextClientData) => item.key.split(`${this.prefix}${this.separator}`)[1],
    );
  }

  async getEntries(): Promise<[string, any][]> {
    const relevantItems = await this.getRelevantItems();
    return relevantItems.map((item) => [
      item.key.replace(`${this.prefix}${this.separator}`, ""),
      item.value,
    ]);
  }

  private async getRelevantItems(): Promise<ConnextClientData[]> {
    return ConnextClientData.findAll({
      where: {
        key: {
          [Op.startsWith]: `${this.prefix}${this.separator}`,
        },
      },
    });
  }

  async clear(): Promise<void> {
    await ConnextClientData.destroy({
      where: {
        key: {
          [Op.startsWith]: `${this.prefix}${this.separator}`,
        },
      },
    });
  }

  async init(): Promise<void> {
    return this.syncModels(false);
  }

  async syncModels(force: boolean = false): Promise<void> {
    await this.sequelize.sync({ force });
  }

  getKey(...args: string[]): string {
    return args.join(this.separator);
  }
}
