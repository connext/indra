import { WrappedStorage } from "@connext/types";
import { Sequelize, Op } from "sequelize";

import { ConnextClientData, ConnextClientDataInitParams } from "../helpers";
import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  DEFAULT_DATABASE_STORAGE_TABLE_NAME,
} from "../constants";

export class WrappedPostgresStorage implements WrappedStorage {
  public sequelize: Sequelize;
  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
    private readonly tableName: string = DEFAULT_DATABASE_STORAGE_TABLE_NAME,
    sequelize?: Sequelize,
    private readonly connectionUri?: string,
  ) {
    if (sequelize) {
      this.sequelize = sequelize;
    } else if (this.connectionUri) {
      this.sequelize = new Sequelize(this.connectionUri);
    } else {
      throw new Error(`Either sequelize instance or Postgres connection URI must be specified`);
    }
    ConnextClientData.init(ConnextClientDataInitParams, {
      sequelize: this.sequelize,
      tableName: this.tableName,
    });
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const item = await ConnextClientData.findByPk(`${this.prefix}${this.separator}${key}`);
    return item && item.value as any;
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
    return relevantItems.map(item => [
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

  async syncModels(force: boolean = false): Promise<void> {
    await this.sequelize.sync({ force });
  }

  getKey(...args: string[]): string {
    return args.join(this.separator);
  }
}
