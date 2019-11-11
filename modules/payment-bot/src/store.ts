import { ConnextClientStorePrefix } from "@connext/types";
import { Node as CFCoreTypes } from "@connext/cf-types";
import { Wallet } from "ethers";
import { arrayify, hexlify, keccak256, toUtf8Bytes, toUtf8String } from "ethers/utils";
import fs from "fs";
import PisaClient from "pisa-client";

import { config } from "./config";

export class Store implements CFCoreTypes.IStoreService {
  private storeObj: any;

  constructor(private readonly pisaClient?: PisaClient, private readonly wallet?: Wallet) {}

  public async get(path: string): Promise<any> {
    if (!this.storeObj) {
      this.storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    const raw = this.storeObj[`${ConnextClientStorePrefix}:${path}`];
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    // Handle partial matches so the following line works -.-
    // https://github.com/counterfactual/monorepo/blob/master/packages/node/src/store.ts#L54
    if (path.endsWith("channel") || path.endsWith("appInstanceIdToProposedAppInstance")) {
      const partialMatches = {};
      for (const k of Object.keys(this.storeObj)) {
        if (k.includes(`${path}/`)) {
          try {
            partialMatches[
              k.replace(`${ConnextClientStorePrefix}:`, "").replace(`${path}/`, "")
            ] = JSON.parse(this.storeObj[k]);
          } catch {
            partialMatches[
              k.replace(`${ConnextClientStorePrefix}:`, "").replace(`${path}/`, "")
            ] = this.storeObj[k];
          }
        }
      }
      return partialMatches;
    }
    return raw;
  }

  public async set(
    pairs: { path: string; value: any }[],
    shouldBackup: boolean = false,
  ): Promise<void> {
    if (!this.storeObj) {
      this.storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    for (const pair of pairs) {
      this.storeObj[`${ConnextClientStorePrefix}:${pair.path}`] =
        typeof pair.value === "string" ? pair.value : JSON.stringify(pair.value);
      if (
        shouldBackup &&
        this.pisaClient &&
        pair.path.match(/\/xpub.*\/channel\/0x[0-9a-fA-F]{40}/) &&
        pair.value.freeBalanceAppInstance &&
        this.wallet
      ) {
        try {
          console.log(`Backing up store value at path ${pair.path}`);
          await this.pisaClient.backUp(
            (digest: string): Promise<string> => this.wallet!.signMessage(arrayify(digest)),
            this.wallet.address,
            hexlify(toUtf8Bytes(JSON.stringify(pair))),
            await this.wallet.provider.getBlockNumber(),
            keccak256(toUtf8Bytes(pair.path)),
            pair.value.freeBalanceAppInstance.latestVersionNumber,
          );
        } catch (e) {
          // If we get a "nonce too low" error, we'll log & ignore bc sometimes expected. See:
          // see: https://github.com/counterfactual/monorepo/issues/2497
          if (e.message && e.message.match(/Appointment already exists and nonce too low./)) {
            console.warn(e);
          } else {
            console.error(e);
          }
        }
      }
    }
    fs.unlinkSync(config.dbFile);
    fs.writeFileSync(config.dbFile, JSON.stringify(this.storeObj, null, 2));
  }

  public async reset(): Promise<void> {
    if (!this.storeObj) {
      this.storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    for (const k of Object.keys(this.storeObj)) {
      if (k.startsWith(ConnextClientStorePrefix)) {
        delete this.storeObj[k];
      }
    }
    delete this.storeObj[`${ConnextClientStorePrefix}:EXTENDED_PRIVATE_KEY`];
    fs.unlinkSync(config.dbFile);
    fs.writeFileSync(config.dbFile, JSON.stringify(this.storeObj, null, 2));
  }

  public async restore(): Promise<any[]> {
    return this.pisaClient && this.wallet
      ? (await this.pisaClient.restore(
          (digest: string): Promise<string> => this.wallet!.signMessage(arrayify(digest)),
          this.wallet.address,
          await this.wallet.provider.getBlockNumber(),
        )).map((b: any): any => JSON.parse(toUtf8String(arrayify(b.data))))
      : [];
  }
}
