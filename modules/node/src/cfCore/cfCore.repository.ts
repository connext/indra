import { EntityRepository, Like, Repository } from "typeorm";

import { CLogger } from "../util";

import { CFCoreRecord } from "./cfCore.entity";

const logger = new CLogger("CFCoreRecordRepository");

type StringKeyValue = { [path: string]: StringKeyValue };

@EntityRepository(CFCoreRecord)
export class CFCoreRecordRepository extends Repository<CFCoreRecord> {
  async reset(): Promise<void> {
    await this.clear();
  }

  async get(path: string): Promise<StringKeyValue | string | undefined> {
    // logger.log(`Getting path from store: ${path}`);
    let res: any;
    if (path.endsWith("channel")) {
      res = await this.createQueryBuilder("node_records")
        .where("node_records.path like :path", { path: `%${path}%` })
        .getMany();
      const records = {};
      res.forEach((record: CFCoreRecord): void => {
        const key = record.value["multisigAddress"];
        const value = record.value;
        if (value !== null) {
          records[key] = value;
        }
      });
      // logger.log(`Got ${Object.keys(records).length} values: ${JSON.stringify(records)}`);
      return records;
    }
    res = await this.findOne({ path });
    if (!res) {
      return undefined;
    }
    // logger.debug(`Got value: ${stringify(res.value[path])}`);
    return res.value;
  }

  async set(pairs: { path: string; value: any }[]): Promise<void> {
    for (const pair of pairs) {
      const record = { path: pair.path, value: pair.value };
      // logger.debug(`Saving record: ${stringify(record)}`);
      await this.save(record);
    }
  }
}
