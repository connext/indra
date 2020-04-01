import { IBackupServiceAPI, WrappedStorage } from "@connext/types";
import { Sequelize, Op } from "sequelize";

import {
  DEFAULT_STORE_PREFIX,
  DEFAULT_STORE_SEPARATOR,
  CHANNEL_KEY,
  COMMITMENT_KEY,
  ConnextClientData,
  ConnextClientDataInitParams,
  DEFAULT_POSTGRES_TABLE_NAME,
} from "../helpers";

export class WrappedPostgresStorage implements WrappedStorage {
  private sequelize: Sequelize;

  constructor(
    private readonly connectionUri: string,
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = DEFAULT_STORE_SEPARATOR,
    private readonly tableName: string = DEFAULT_POSTGRES_TABLE_NAME,
    private readonly backupService?: IBackupServiceAPI,
  ) {
    this.initSequelize(this.connectionUri);
  }

  initSequelize(connectionUri: string): void {
    this.sequelize = new Sequelize(connectionUri);
    ConnextClientData.init(ConnextClientDataInitParams, {
      sequelize: this.sequelize,
      tableName: this.tableName,
    });
  }

  async getItem(key: string): Promise<string | undefined> {
    const item = await ConnextClientData.findByPk(`${this.prefix}${this.separator}${key}`);
    return item && item.value;
  }

  async setItem(key: string, value: string): Promise<void> {
    const shouldBackup = key.includes(CHANNEL_KEY) || key.includes(COMMITMENT_KEY);
    if (this.backupService && shouldBackup) {
      try {
        await this.backupService.backup({ path: key, value });
      } catch (e) {
        console.info(`Could not save ${key} to backup service. Error: ${e.stack || e.message}`);
      }
    }
    const item = ConnextClientData.build({
      key: `${this.prefix}${this.separator}${key}`,
      value,
    });
    return item.save();
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

  // NOTE: the backup service should store only the key without prefix.
  // see the `setItem` implementation
  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    const pairs = await this.backupService.restore();
    await Promise.all(pairs.map(pair => this.setItem(pair.path, pair.value)));
  }

  getKey(...args: string[]): string {
    return args.join(this.separator);
  }
}
