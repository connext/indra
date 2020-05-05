import { WrappedStorage } from "@connext/types";
import { safeJsonParse, safeJsonStringify } from "@connext/utils";
import writeFileAtomic from "write-file-atomic";

import {
  createDirectory,
  fsUnlink,
  getDirectoryFiles,
  safeFsRead,
  sanitizeExt,
  pathJoin,
} from "../helpers";
import {
  DEFAULT_FILE_STORAGE_DIR,
  DEFAULT_FILE_STORAGE_EXT,
  DEFAULT_STORE_PREFIX,
} from "../constants";

export class FileStorage implements WrappedStorage {
  constructor(
    private readonly prefix: string = DEFAULT_STORE_PREFIX,
    private readonly separator: string = "-",
    private readonly fileExt: string = DEFAULT_FILE_STORAGE_EXT,
    private readonly fileDir: string = DEFAULT_FILE_STORAGE_DIR,
  ) {
    if (this.separator === "/") {
      throw new Error(`Invalid file separator provided: ${this.separator}`);
    }
    this.fileExt = fileExt ? sanitizeExt(fileExt) : DEFAULT_FILE_STORAGE_EXT;
    if (!this.fileExt.trim()) {
      throw new Error(`Provided fileExt (${this.fileExt}) is invalid`);
    }
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
    return pathJoin(this.fileDir, fileName);
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const filePath = await this.getFilePath(key);
    const item = await safeFsRead(filePath);
    return safeJsonParse(item);
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const filePath = await this.getFilePath(key);
    return writeFileAtomic(filePath, safeJsonStringify(value));
  }

  async removeItem(key: string): Promise<void> {
    const filePath = await this.getFilePath(key);
    return fsUnlink(filePath);
  }

  async getKeys(): Promise<string[]> {
    await this.checkFileDir();
    const relevantKeys = (await getDirectoryFiles(this.fileDir))
      .filter((file: string) => file.includes(this.fileSuffix) && file.includes(this.prefix))
      .map((file: string) => file.replace(this.fileSuffix, ""));
    return relevantKeys.map((key) => key.split(`${this.prefix}${this.separator}`)[1]);
  }

  async getEntries(): Promise<[string, any][]> {
    const keys = await this.getKeys();
    const entries = [];
    for (const key of keys) {
      entries.push([key, await this.getItem(key)]);
    }
    return entries;
  }

  getKey(...args: string[]): string {
    let str = "";
    args.forEach((arg) => {
      // dont add separator to last one
      str = str.concat(arg, args.indexOf(arg) === args.length - 1 ? "" : this.separator);
    });
    return str;
  }
}
