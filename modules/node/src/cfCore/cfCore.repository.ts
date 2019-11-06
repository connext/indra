import { EntityRepository, Like, Repository } from "typeorm";

import { CLogger, stringify } from "../util";

import { CFCoreRecord } from "./cfCore.entity";
import { LATEST_CF_STORE_VERSION } from "./cfCore.provider";

type StringKeyValue = { [path: string]: StringKeyValue };

const logger = new CLogger("CFCoreRecordRepository");

const COMMITMENT_PATH = "commitments";
const VERSION_PATH = "version";
const WITHDRAWAL_PATH = "withdrawals";

@EntityRepository(CFCoreRecord)
export class CFCoreRecordRepository extends Repository<CFCoreRecord> {
  async reset(): Promise<void> {
    await this.clear();
  }

  async get(path: string): Promise<StringKeyValue | string | undefined> {
    logger.debug(`Getting path from store: ${path}`);

    // get all the channel records
    const res = await this.find({
      path: Like(`${path}/channel/%/version/${LATEST_CF_STORE_VERSION}`),
    });

    // put them together into a big blob
    const stateChannelsMap = {};
    for (const channelRecord of res) {
      // INDRA_NODE_CF_CORE/<XPUB>/channel/<MULTISIG>/version/<NUM>
      const multisigAddress = channelRecord.path.split("/")[3];
      stateChannelsMap[multisigAddress] = channelRecord.value;
    }

    const commitments = await this.findOne(
      `${path}/${COMMITMENT_PATH}/version/${LATEST_CF_STORE_VERSION}`,
    );
    const withdrawals = await this.findOne(
      `${path}/${WITHDRAWAL_PATH}/version/${LATEST_CF_STORE_VERSION}`,
    );

    // this corresponds to version 1 of the store spec
    const getValue = {
      commitments: commitments ? commitments.value : {},
      stateChannelsMap: stateChannelsMap || {},
      version: LATEST_CF_STORE_VERSION,
      withdrawals: withdrawals ? withdrawals.value : {},
    } as any;
    logger.debug(`Returning value ${JSON.stringify(getValue)} for path ${path}`);
    return getValue;
  }

  async set(pairs: { path: string; value: any }[]): Promise<void> {
    for (const pair of pairs) {
      logger.debug(`Saving record for path: ${pair.path}`);
      // Wrapping the value into an object is necessary for Postgres bc the JSON column breaks
      // if you use anything other than JSON (i.e. a raw string).
      // In some cases, the cf core code is inserting strings as values instead of objects :(
      const { stateChannelsMap, withdrawals, commitments } = pair.value;

      const savePromises = Object.entries(stateChannelsMap).map(
        async ([multisigAddress, channelData]: [string, StringKeyValue]): Promise<CFCoreRecord> => {
          const newPath = `${pair.path}/channel/${multisigAddress}/version/${LATEST_CF_STORE_VERSION}`;
          let record = await this.findOne({ where: { path: newPath } });
          if (record) {
            record.value = channelData;
          } else {
            record = { path: newPath, value: channelData } as CFCoreRecord;
          }
          return this.save(record);
        },
      );

      const commitmentPath = `${pair.path}/${COMMITMENT_PATH}/version/${LATEST_CF_STORE_VERSION}`;
      let saveCommitments = await this.findOne({
        where: { path: commitmentPath },
      });
      if (saveCommitments) {
        saveCommitments.value = commitments;
      } else {
        saveCommitments = {
          path: commitmentPath,
          value: commitments || {},
        } as CFCoreRecord;
      }
      const saveCommitmentsPromise = this.save(saveCommitments);

      const withdrawalsPath = `${pair.path}/${WITHDRAWAL_PATH}/version/${LATEST_CF_STORE_VERSION}`;
      let saveWithdrawals = await this.findOne({
        where: { path: withdrawalsPath },
      });
      if (saveWithdrawals) {
        saveWithdrawals.value = withdrawals;
      } else {
        saveWithdrawals = {
          path: withdrawalsPath,
          value: withdrawals || {},
        } as CFCoreRecord;
      }
      const saveWithdrawalsPromise = this.save(saveWithdrawals);

      savePromises.concat([saveCommitmentsPromise, saveWithdrawalsPromise]);

      await Promise.all(savePromises);
    }
  }

  async getV0(path: string): Promise<StringKeyValue | string | undefined> {
    // logger.debug(`Getting path from store: ${path}`);
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
      // logger.log(`Got ${Object.keys(records).length} values: ${JSON.stringify(records)}`);
      return records;
    }
    res = await this.findOne({ path });
    if (!res) {
      return undefined;
    }
    // logger.log(`Got value: ${JSON.stringify(res.value[path])}`);
    return res.value[path];
  }

  async getLegacyCFCoreRecord(multisigAddress: string): Promise<CFCoreRecord> {
    return await this.findOneOrFail({ path: Like(`%${multisigAddress}`) });
  }

  async deleteLegacyCFCoreRecords(): Promise<CFCoreRecord[] | void> {
    const legacyRecords = await this.find({
      path: Like(`%channel/__________________________________________`),
    });
    console.log("would have deleted these: ", stringify(legacyRecords, 2));
    return;
    // return await this.remove(legacyRecords);
  }
}
