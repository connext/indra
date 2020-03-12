import path from "path";

import {
  createDirectory,
  createDirectorySync,
  DEFAULT_FILE_STORAGE_DIR,
  DEFAULT_FILE_STORAGE_EXT,
  fsUnlink,
  fsWrite,
  getDirectoryFiles,
  safeFsRead,
  sanitizeExt,
  DEFAULT_STORE_PREFIX,
  CHANNEL_KEY,
  COMMITMENT_KEY,
} from "../helpers";
import { IBackupServiceAPI, WrappedStorage } from "@connext/types";

export class FileStorage implements WrappedStorage {
  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = "-",
    private readonly fileExt: string = DEFAULT_FILE_STORAGE_EXT,
    private readonly fileDir: string = DEFAULT_FILE_STORAGE_DIR,
    private readonly backupService?: IBackupServiceAPI,
  ) {
    if (this.separator === "/") {
      throw new Error(`Invalid file separator provided: ${this.separator}`);
    }
    this.fileExt = fileExt ? sanitizeExt(fileExt) : DEFAULT_FILE_STORAGE_EXT;
    if (!this.fileExt.trim()) {
      throw new Error(`Provided fileExt (${this.fileExt}) is invalid`);
    }

    createDirectorySync(this.fileDir);
  }

  get fileSuffix(): string {
    return `${this.fileExt}`;
  }

  async checkFileDir(): Promise<void> {
    return createDirectory(this.fileDir);
  }

  async getFilePath(key: string): Promise<string> {
    await this.checkFileDir();
    const fileName = `${this.prefix}${this.separator}${key}${this.fileSuffix}`;
    return path.join(this.fileDir, fileName);
  }

  async getItem(key: string): Promise<string | undefined> {
    const filePath = await this.getFilePath(key);
    return safeFsRead(filePath) || undefined;
  }

  async setItem(key: string, data: string): Promise<void> {
    const shouldBackup = key.includes(CHANNEL_KEY) || key.includes(COMMITMENT_KEY);
    if (this.backupService && shouldBackup) {
      await this.backupService.backup({ path: key, value: data });
    }
    const filePath = await this.getFilePath(key);
    return fsWrite(filePath, data);
  }

  async removeItem(key: string): Promise<void> {
    const filePath = await this.getFilePath(key);
    return fsUnlink(filePath);
  }

  async getKeys(): Promise<string[]> {
    const relevantKeys = (await getDirectoryFiles(this.fileDir))
      .filter((file: string) => file.includes(this.fileSuffix) && file.includes(this.prefix))
      .map((file: string) => file.replace(this.fileSuffix, ""));
    return relevantKeys.map(key => key.split(`${this.prefix}${this.separator}`)[1]);
  }

  async getEntries(): Promise<[string, any][]> {
    const keys = await this.getKeys();
    const entries = [];
    for (const key of keys) {
      entries.push([key, await this.getItem(key)]);
    }
    return entries;
  }

  async clear(): Promise<void> {
    const keys = await this.getKeys();
    await Promise.all(keys.map(key => this.removeItem(key)));
  }

  async restore(): Promise<void> {
    await this.clear();
    if (!this.backupService) {
      throw new Error(`No backup provided, store cleared`);
    }
    // otherwise set the item
    const pairs = await this.backupService.restore();
    await Promise.all(pairs.map(pair => this.setItem(pair.path, pair.value)));
  }

  getKey(...args: string[]): string {
    let str = "";
    args.forEach(arg => {
      // dont add separator to last one
      str = str.concat(arg, args.indexOf(arg) === args.length - 1 ? "" : this.separator);
    });
    return str;
  }
}
