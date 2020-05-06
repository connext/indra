import { DataTypes, Op, Sequelize } from "sequelize";
import { mkdirSync } from "fs";
import { dirname } from "path";

import { storeDefaults } from "../constants";
import { WrappedStorage } from "../types";

type SupportedDialects = "postgres" | "sqlite";

const getConnextClientDataInitParams = (dialect: SupportedDialects) => {
  let valueDataType = DataTypes.JSON;
  if (dialect === "postgres") {
    valueDataType = DataTypes.JSONB;
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
  private ConnextClientData: any;

  constructor(
    private readonly prefix: string = storeDefaults.PREFIX,
    private readonly separator: string = storeDefaults.SEPARATOR,
    private readonly tableName: string = storeDefaults.DATABASE_TABLE_NAME,
    sequelize?: Sequelize,
    private readonly connectionUri?: string,
  ) {
    if (sequelize) {
      this.sequelize = sequelize;
    } else if (this.connectionUri) {
      if (this.connectionUri.startsWith("sqlite:")) {
        const dbPath = this.connectionUri.split("sqlite:").pop();
        if (dbPath !== storeDefaults.SQLITE_MEMORY_STORE_STRING) {
          const dir = dirname(dbPath);
          mkdirSync(dir, { recursive: true });
        }
      }
      this.sequelize = new Sequelize(this.connectionUri, { logging: false });
    } else {
      throw new Error(`Must specify sequelize instance or connectionUri`);
    }

    this.ConnextClientData = this.sequelize.define(
      this.tableName,
      getConnextClientDataInitParams(this.sequelize.getDialect() as SupportedDialects),
    );
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const item = await this.ConnextClientData.findByPk(`${this.prefix}${this.separator}${key}`);
    return item && (item.value as any);
  }

  async setItem(key: string, value: any): Promise<void> {
    await this.ConnextClientData.upsert({
      key: `${this.prefix}${this.separator}${key}`,
      value,
    });
  }

  async removeItem(key: string): Promise<void> {
    await this.ConnextClientData.destroy({
      where: {
        key: `${this.prefix}${this.separator}${key}`,
      },
    });
  }

  async getKeys(): Promise<string[]> {
    const relevantItems = await this.getRelevantItems();
    return relevantItems.map(
      (item: any) => item.key.split(`${this.prefix}${this.separator}`)[1],
    );
  }

  async getEntries(): Promise<[string, any][]> {
    const relevantItems = await this.getRelevantItems();
    return relevantItems.map((item) => [
      item.key.replace(`${this.prefix}${this.separator}`, ""),
      item.value,
    ]);
  }

  private async getRelevantItems(): Promise<any[]> {
    return this.ConnextClientData.findAll({
      where: {
        key: {
          [Op.startsWith]: `${this.prefix}${this.separator}`,
        },
      },
    });
  }

  async clear(): Promise<void> {
    await this.ConnextClientData.destroy({
      where: {
        key: {
          [Op.startsWith]: `${this.prefix}${this.separator}`,
        },
      },
    });
  }

  async init(): Promise<void> {
    await this.syncModels(false);
  }

  async syncModels(force: boolean = false): Promise<void> {
    await this.sequelize.sync({ force });
  }

  getKey(...args: string[]): string {
    return args.join(this.separator);
  }
}
