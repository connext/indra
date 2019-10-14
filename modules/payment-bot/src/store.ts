import { ConnextClientStorePrefix } from "@connext/types";
import { Node as CFCoreTypes } from "@counterfactual/types";
import { Wallet } from "ethers";
import { BaseProvider } from "ethers/providers";
import { arrayify, hexlify, keccak256, toUtf8Bytes, toUtf8String } from "ethers/utils";
import fs from "fs";
import PisaClient from "pisa-client";

import { config } from "./config";

interface PisaOptions {
  readonly provider: BaseProvider;
  wallet: Wallet;
  readonly pisaClient: PisaClient;
}

export class Store implements CFCoreTypes.IStoreService {
  private storeObj: any;
  private static PisaPathRegex: RegExp = /.*\/xpub.*\/channel\/0x[0-9a-fA-F]{40}/;
  private static PisaNonceTooLowRegex: RegExp = /Appointment already exists and nonce too low. Should be greater than (\d+)\./;

  constructor(private readonly pisaOptions?: PisaOptions) {}

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
    allowDelete?: Boolean | undefined,
    updatePisa: Boolean = true,
  ): Promise<void> {
    if (!this.storeObj) {
      this.storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    for (const pair of pairs) {
      this.storeObj[`${ConnextClientStorePrefix}:${pair.path}`] =
        typeof pair.value === "string" ? pair.value : JSON.stringify(pair.value);

      if (
        this.pisaOptions &&
        updatePisa &&
        Store.PisaPathRegex.exec(pair.path) &&
        pair.value.freeBalanceAppInstance
      ) {
        const version = pair.value.freeBalanceAppInstance.latestVersionNumber as number;
        await this.backupToPisa(
          this.pisaOptions.pisaClient,
          this.pisaOptions.provider,
          this.pisaOptions.wallet,
          pair.path,
          pair,
          version,
        );
      }
    }
    fs.unlinkSync(config.dbFile);
    fs.writeFileSync(config.dbFile, JSON.stringify(this.storeObj, null, 2));
  }

  public async reset(wallet?: Wallet): Promise<void> {
    if (!this.storeObj) {
      this.storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    for (const k of Object.keys(this.storeObj)) {
      if (k.startsWith(ConnextClientStorePrefix)) {
        delete this.storeObj[k];
      }
    }
    fs.unlinkSync(config.dbFile);
    fs.writeFileSync(config.dbFile, JSON.stringify(this.storeObj, null, 2));

    if (this.pisaOptions && wallet) this.pisaOptions.wallet = wallet;
  }

  public async restore(): Promise<{ path: string; value: any }[]> {
    if (this.pisaOptions) {
      return await this.restoreFromPisa(
        this.pisaOptions.pisaClient,
        this.pisaOptions.provider,
        this.pisaOptions.wallet,
      );
    }
    return [];
  }

  private async restoreFromPisa(
    pisaClient: PisaClient,
    provider: BaseProvider,
    wallet: Wallet,
  ): Promise<{ path: string; value: any }[]> {
    const currentBlockNumber = await provider.getBlockNumber();

    const restoreStates = await pisaClient.restore(
      (digest: string) => wallet.signMessage(arrayify(digest)),
      wallet.address,
      currentBlockNumber,
    );

    return restoreStates.map(
      (b: { data: string }) =>
        JSON.parse(toUtf8String(arrayify(b.data))) as {
          path: string;
          value: any;
        },
    );
  }

  private async backupToPisa(
    pisaClient: PisaClient,
    provider: BaseProvider,
    wallet: Wallet,
    path: string,
    data: any,
    version: number,
  ): Promise<void> {
    let stringed;
    try {
      stringed = JSON.stringify(data);
      // stringify the data
      const bytes = toUtf8Bytes(stringed);
      const hex = hexlify(bytes);

      const currentBlockNumber = await provider.getBlockNumber();

      await pisaClient.backup(
        (digest: string) => wallet.signMessage(arrayify(digest)),
        wallet.address,
        hex,
        currentBlockNumber,
        keccak256(toUtf8Bytes(path)),
        version,
      );
    } catch (doh) {
      // if the error message matches the "nonce too low" regex we'll swallow
      // as this is potentially expected behaviour
      // see: https://github.com/counterfactual/monorepo/issues/2497
      if (doh.message) {
        const matches = doh.message.match(Store.PisaNonceTooLowRegex);
        if (matches && Number.parseInt(matches[1], 10) === version) {
          console.error(doh);
          console.error(stringed);
          return;
        }
      }
      throw doh;
    }
  }
}
