import path from "path";
import uuid from "uuid";

import {
  createDirectorySync,
  DEFAULT_FILE_STORAGE_DIR,
  DEFAULT_FILE_STORAGE_EXT,
  FileStorageOptions,
  fsUnlink,
  fsWrite,
  IAsyncStorage,
  isDirectorySync,
  safeFsRead,
  sanitizeExt,
} from "../helpers";

export class FileStorage implements IAsyncStorage {
  private uuid: string;
  private fileExt: string = DEFAULT_FILE_STORAGE_EXT;
  private fileDir: string = DEFAULT_FILE_STORAGE_DIR;

  constructor(opts?: FileStorageOptions) {
    if (opts) {
      this.fileDir = opts.fileDir || DEFAULT_FILE_STORAGE_DIR;
      if (!isDirectorySync(this.fileDir)) {
        throw new Error(`Provided fileDir (${this.fileDir}) is not a directory`);
      }

      this.fileExt = opts.fileExt ? sanitizeExt(opts.fileExt) : DEFAULT_FILE_STORAGE_EXT;
      if (!this.fileExt.trim()) {
        throw new Error(`Provided fileExt (${this.fileExt}) is invalid`);
      }
    }

    createDirectorySync(this.fileDir);

    this.uuid = uuid.v1();
  }

  getFilePath(key: string): string {
    const fileName = `${key}-${this.uuid}${this.fileExt}`;
    return path.join(this.fileDir, fileName);
  }

  async getItem(key: string): Promise<string | null> {
    const filePath = this.getFilePath(key);
    return await safeFsRead(filePath);
  }
  async setItem(key: string, data: any): Promise<void> {
    const filePath = this.getFilePath(key);
    return fsWrite(filePath, data);
  }

  async removeItem(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    return await fsUnlink(filePath);
  }
}
