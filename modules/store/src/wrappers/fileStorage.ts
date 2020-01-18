import path from "path";
import uuid from "uuid";

import {
  createDirectorySync,
  DEFAULT_FILE_STORAGE_DIR,
  DEFAULT_FILE_STORAGE_EXT,
  FileStorageOptions,
  fsUnlink,
  fsWrite,
  getDirectoryFiles,
  IAsyncStorage,
  safeFsRead,
  sanitizeExt,
} from "../helpers";

export class FileStorage implements IAsyncStorage {
  private uuid: string;
  private separator: string = "-";
  private fileExt: string = DEFAULT_FILE_STORAGE_EXT;
  private fileDir: string = DEFAULT_FILE_STORAGE_DIR;

  constructor(opts?: FileStorageOptions) {
    if (opts) {
      this.fileDir = opts.fileDir || DEFAULT_FILE_STORAGE_DIR;

      this.fileExt = opts.fileExt ? sanitizeExt(opts.fileExt) : DEFAULT_FILE_STORAGE_EXT;
      if (!this.fileExt.trim()) {
        throw new Error(`Provided fileExt (${this.fileExt}) is invalid`);
      }
    }

    createDirectorySync(this.fileDir);

    this.uuid = uuid.v1();
  }

  get fileSuffix(): string {
    return `${this.separator}${this.uuid}${this.fileExt}`;
  }

  getFilePath(key: string): string {
    const fileName = `${key}${this.fileSuffix}`;
    return path.join(this.fileDir, fileName);
  }

  async getItem(key: string): Promise<string | null> {
    const filePath = this.getFilePath(key);
    return safeFsRead(filePath);
  }

  async setItem(key: string, data: any): Promise<void> {
    const filePath = this.getFilePath(key);
    return fsWrite(filePath, data);
  }

  async removeItem(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    return fsUnlink(filePath);
  }

  async clear(): Promise<void> {
    const keys = await this.getAllKeys();
    await Promise.all(keys.map(key => this.removeItem(key)));
  }
  async getAllKeys(): Promise<string[]> {
    const keys = (await getDirectoryFiles(this.fileDir))
      .filter((file: string) => file.includes(this.fileSuffix))
      .map((file: string) => file.replace(this.fileSuffix, ""));
    return keys;
  }
}
