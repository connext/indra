import { EntityRepository, Like, Repository } from "typeorm";

import { CFCoreRecord } from "./cfCore.entity";

// import { LoggerService } from "../logger/logger.service";
// const log = new LoggerService("CFCoreRepository");

type StringKeyValue = { [path: string]: StringKeyValue };

@EntityRepository(CFCoreRecord)
export class CFCoreRecordRepository extends Repository<CFCoreRecord> {
  async reset(): Promise<void> {
    await this.clear();
  }

  async get(path: string): Promise<StringKeyValue | string | undefined> {
    // log.info(`Getting path from store: ${path}`);
    let res: any;
    // FIXME: this queries for all channels or proposed app instances, which
    // are nested under the respective keywords, hence the 'like' keyword
    // Action item: this hack won't be needed when a more robust schema around
    // node records is implemented
    if (path.endsWith("channel") || path.endsWith("appInstanceIdToProposedAppInstance")) {
      res = await this.createQueryBuilder("node_records")
        .where("node_records.path like :path", { path: `%${path}%` })
        .getMany();
      const nestedRecords = res.map((record: CFCoreRecord) => {
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
        // FIXME: the store implementation (firebase) that the cf core used in the
        // very first implementation of the store assumed that values which are
        // null wouldn't contain key entries in the returned object so we have to
        // explicitly remove these when Postgres correctly returns even null values
        if (value !== null) {
          records[key] = value;
        }
      });
      // log.info(`Got ${Object.keys(records).length} values: ${JSON.stringify(records)}`);
      return records;
    }
    res = await this.findOne({ path });
    if (!res) {
      return undefined;
    }
    // log.debug(`Got value: ${stringify(res.value[path])}`);
    return res.value[path];
  }

  async set(pairs: { path: string; value: any }[]): Promise<void> {
    for (const pair of pairs) {
      // Wrapping the value into an object is necessary for Postgres bc the JSON column breaks
      // if you use anything other than JSON (i.e. a raw string).
      // In some cases, the cf core code is inserting strings as values instead of objects :(
      const record = { path: pair.path, value: { [pair.path]: pair.value } };
      // log.debug(`Saving record: ${stringify(record)}`);
      await this.save(record);
    }
  }

  async findRecordsForRestore(multisigAddress: string): Promise<CFCoreRecord[]> {
    return await this.find({ path: Like(`%${multisigAddress}`) });
  }
}
