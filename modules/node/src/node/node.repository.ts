import { EntityManager, EntityRepository, Repository } from "typeorm";

import { CLogger } from "../util";

import { NodeRecord } from "./node.entity";

const logger = new CLogger("NodeRecordRepository");
export const keyPrefix = "connextHub";

type StringKeyValue = { [path: string]: StringKeyValue };

@EntityRepository(NodeRecord)
export class NodeRecordRepository extends Repository<NodeRecord> {
  async reset(): Promise<void> {
    await this.clear();
  }

  async get(path: string): Promise<StringKeyValue | string | undefined> {
    const storeKey = `${keyPrefix}_${path}`;
    logger.log(`Getting path from store: ${storeKey}`);
    let res;
    // FIXME: this queries for all channels or proposed app instances, which
    // are nested under the respective keywords, hence the 'like' keyword
    // Action item: this hack won't be needed when a more robust schema around
    // node records is implemented
    if (path.endsWith("channel") || path.endsWith("appInstanceIdToProposedAppInstance")) {
      logger.log(`Ohh it's a special path`);
      res = await this.createQueryBuilder("node_records")
        .where("node_records.path like :path", { path: `%${storeKey}%` })
        .getMany();
      logger.log(`Got a result ${JSON.stringify(res)}`);
      const nestedRecords = res.map((record: NodeRecord) => {
        const existingKey = Object.keys(record.value)[0];
        const leafKey = existingKey.split("/").pop()!;
        const nestedValue = record.value[existingKey];
        delete record.value[existingKey];
        record.value[leafKey] = nestedValue;
        return record.value;
      });
      logger.log(`Got nested records`);
      logger.log(`Got nested records: ${JSON.stringify(nestedRecords)}`);
      const records = {};
      nestedRecords.forEach((record: any): void => {
        const key = Object.keys(record)[0];
        const value = Object.values(record)[0];
        // FIXME: the store implementation (firebase) that the node used in the
        // very first implementation of the store assumed that values which are
        // null wouldn't contain key entries in the returned object so we have to
        // explicitly remove these when Postgres correctly returns even null values
        if (value !== null) {
          records[path] = value;
        }
      });
      logger.log(`Got records: ${JSON.stringify(records)}`);
      return records;
    }
    res = await this.findOne({ path: storeKey });
    if (!res) {
      return undefined;
    }
    logger.log(`Success, got value: ${JSON.stringify(res.value[path])}`);
    return res.value[path];
  }

  async set(pairs: { path: string; value: any }[]): Promise<void> {
    for (const pair of pairs) {
      // Wrapping the value into an object is necessary for Postgres bc the JSON column breaks
      // if you use anything other than JSON (i.e. a raw string).
      // In some cases, the node code is inserting strings as values instead of objects :(
      const record = { path: `${keyPrefix}_${pair.path}`, value: { [pair.path]: pair.value } };
      logger.log(`Saving record: ${JSON.stringify(record)}`);
      await this.save(record);
    }
  }
}
