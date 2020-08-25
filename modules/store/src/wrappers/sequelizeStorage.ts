import { DataTypes, Op, Sequelize, Transaction } from "sequelize";
import { mkdirSync } from "fs";
import { dirname } from "path";

import { storeDefaults } from "../constants";
import { KeyValueStorage } from "../types";

type SupportedDialects = "postgres" | "sqlite";

export class WrappedSequelizeStorage implements KeyValueStorage {
  public sequelize: Sequelize;
  private ConnextClientData: any;
  // FIXME: Using transactions in the memory store passes the store tests
  // but fails in the integration tests. This only happens for memory store,
  // and there are similarly reported issues. See:
  // https://github.com/sequelize/sequelize/issues/8759
  private shouldUseTransaction: boolean = true;

  constructor(
    _sequelize: string | Sequelize,
    private readonly prefix: string = storeDefaults.PREFIX,
    private readonly separator: string = storeDefaults.SEPARATOR,
    private readonly tableName: string = storeDefaults.DATABASE_TABLE_NAME,
  ) {
    if (typeof _sequelize === "string") {
      if ((_sequelize as string).startsWith("sqlite:")) {
        const dbPath = (_sequelize as string).split("sqlite:").pop();
        if (dbPath !== storeDefaults.SQLITE_MEMORY_STORE_STRING) {
          const dir = dirname(dbPath || "");
          mkdirSync(dir, { recursive: true });
        } else {
          // see comments in prop declaration
          this.shouldUseTransaction = false;
        }
      }
      this.sequelize = new Sequelize(_sequelize as string, {
        logging: false,
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED,
        // transactionType: Transaction.TYPES.IMMEDIATE,
      });
    } else {
      this.sequelize = _sequelize as Sequelize;
    }
    this.ConnextClientData = this.sequelize.define(
      this.tableName,
      {
        key: {
          type: new DataTypes.STRING(1024),
          primaryKey: true,
        },
        value: {
          type: this.sequelize.getDialect() === "postgres" ? DataTypes.JSON : DataTypes.JSONB,
        },
      },
    );
  }

  ////////////////////////////////////////
  // Public Methods

  async init(): Promise<void> {
    try {
      await this.sequelize.sync({ force: false });
    } catch (e) {
      throw new Error(`init() failed: ${e.message}`);
    }
  }

  close(): Promise<void> {
    try {
      return this.sequelize.close();
    } catch (e) {
      throw new Error(`close() failed: ${e.message}`);
    }
  }

  getKey(...args: string[]): string {
    try {
      return args.join(this.separator);
    } catch (e) {
      throw new Error(`getKeys() failed: ${e.message}`);
    }
  }

  async getKeys(): Promise<string[]> {
    try {
      const relevantItems = await this.getRelevantItems();
      return relevantItems.map((item: any) => item.key.split(`${this.prefix}${this.separator}`)[1]);
    } catch (e) {
      throw new Error(`getKeys() failed: ${e.message}`);
    }
  }

  async getEntries(): Promise<[string, any][]> {
    try {
      const relevantItems = await this.getRelevantItems();
      return relevantItems.map((item) => [
        item.key.replace(`${this.prefix}${this.separator}`, ""),
        item.value,
      ]);
    } catch (e) {
      throw new Error(`getEntries() failed: ${e.message}`);
    }
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    try {
      const item = await this.ConnextClientData.findByPk(`${this.prefix}${this.separator}${key}`);
      return item && (item.value as any);
    } catch (e) {
      throw new Error(`getItem(${key}) failed: ${e.message}`);
    }
  }

  async setItem(key: string, value: any): Promise<void> {
    try {
      const execute = async (options = {}) => {
        await this.ConnextClientData.upsert(
          {
            key: `${this.prefix}${this.separator}${key}`,
            value,
          },
          options,
        );
      };
      if (!this.shouldUseTransaction) {
        return execute();
      }
      return this.sequelize.transaction(async (t) => {
        await execute({ transaction: t, lock: true });
      });
    } catch (e) {
      throw new Error(`setItem(${key}, ..) failed: ${e.message}`);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const execute = async (options = {}) => {
        await this.ConnextClientData.destroy(
          {
            where: {
              key: `${this.prefix}${this.separator}${key}`,
            },
          },
          options,
        );
      };
      if (!this.shouldUseTransaction) {
        return execute();
      }
      return this.sequelize.transaction(async (t) => {
        await execute({ transaction: t, lock: true });
      });
    } catch (e) {
      throw new Error(`removeItem(${key}) failed: ${e.message}`);
    }
  }

  ////////////////////////////////////////
  // Private Methods

  private async getRelevantItems(): Promise<any[]> {
    try {
      return this.ConnextClientData.findAll({
        where: {
          key: {
            [Op.startsWith]: `${this.prefix}${this.separator}`,
          },
        },
      });
    } catch (e) {
      throw new Error(`getRelevantItems() failed: ${e.message}`);
    }
  }

}
