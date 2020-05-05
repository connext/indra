import { safeJsonParse, safeJsonStringify } from "@connext/utils";
import fs from "fs";
import path from "path";
import writeFileAtomic from "write-file-atomic";

import { storeDefaults } from "../constants";
import { WrappedStorage } from "../types";

export class FileStorage implements WrappedStorage {
  constructor(
    private readonly prefix: string = storeDefaults.PREFIX,
    private readonly separator: string = "-",
    private readonly fileExt: string = ".json",
    private readonly fileDir: string = "./connext-store",
  ) {
    if (this.separator === "/") {
      throw new Error(`Invalid file separator provided: ${this.separator}`);
    }
    this.fileExt = fileExt || this.fileExt;
    if (!this.fileExt.trim()) {
      throw new Error(`Provided fileExt (${this.fileExt}) is invalid`);
    }
  }

  get fileSuffix(): string {
    return `${this.fileExt}`;
  }

  async checkFileDir(): Promise<void> {
    fs.mkdirSync(this.fileDir, { recursive: true });
  }

  async getFilePath(key: string): Promise<string> {
    await this.checkFileDir();
    const fileName = `${this.prefix}${this.separator}${key}${this.fileSuffix}`;
    return path.join(this.fileDir, fileName);
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    const filePath = await this.getFilePath(key);
    try {
      fs.accessSync(filePath, fs.constants.F_OK | fs.constants.W_OK);
    } catch (err) {
      console.warn(`Error getting ${key}: ${err.message}`);
      if (err.code === "ENOENT") {
        console.warn(`File doesn't exist, returning undefined`);
        return undefined;
      } else {
        console.error(`Idk what went wrong, throwing..`);
        throw err;
      }
    }
    console.info(`File exists, reading contents from ${filePath}`);
    const data = fs.readFileSync(filePath, "utf-8");
    console.info(`Read data from file: ${data}`);
    return safeJsonParse(data);
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const filePath = await this.getFilePath(key);
    console.info(`Writing data to ${filePath}`);
    return writeFileAtomic(filePath, safeJsonStringify(value));
  }

  async removeItem(key: string): Promise<void> {
    const filePath = await this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getKeys(): Promise<string[]> {
    await this.checkFileDir();
    const relevantKeys = fs.readdirSync(this.fileDir)
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
