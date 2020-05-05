import fs from "fs";
import path from "path";

const FILE_EXISTS = 1;
const FILE_DOESNT_EXIST = 0;

const fsExists = (path): Promise<boolean> => {
  return new Promise(resolve => {
    fs.exists(path, result => resolve(result));
  });
};

const fsRead = (path: string): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    if (!(await fsExists(path))) {
      resolve(undefined);
    }
    fs.readFile(path, "utf-8", (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
};

const fsStat = (path: string): Promise<fs.Stats> => {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stat) => {
      if (err) {
        return reject(err);
      }
      resolve(stat);
    });
  });
};

const fsMkDir = (path: string): void => {
  fs.mkdirSync(path, { recursive: true });
};

const checkFile = (path: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const mode = fs.constants.F_OK | fs.constants.W_OK;
    fs.access(path, mode, err => {
      if (err) {
        if (err.code === "ENOENT") {
          return resolve(FILE_DOESNT_EXIST);
        }
        return reject(err);
      }
      return resolve(FILE_EXISTS);
    });
  });
};

export const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const fileStat = await fsStat(path);
    return fileStat.isDirectory();
  } catch (e) {
    return false;
  }
};

////////////////////////////////////////
// Exports

export const createDirectory = async (path: string): Promise<void> => {
  if (!(await fsExists(path))) {
    fsMkDir(path);
  }
  return;
};

export const fsUnlink = (path: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.unlink(path, err => {
      if (err) {
        if (err.code === "ENOENT") {
          return resolve();
        }
        return reject(err);
      }
      resolve();
    });
  });
};

export const getDirectoryFiles = (path: string): Promise<string[]> => {
  return new Promise((resolve: any, reject: any): void => {
    fs.readdir(path, (err: Error, files: string[]) => {
      if (err) {
        return reject(err);
      }
      return resolve(files);
    });
  });
};

export const pathJoin = (...args: string[]) => {
  return path.join(...args);
};

export const safeFsRead = async (path: string): Promise<any> => {
  if ((await checkFile(path)) === FILE_DOESNT_EXIST) {
    return undefined;
  }
  return fsRead(path);
};

export const sanitizeExt = (ext: string): string => {
  const result = ext
    .match(/\.?([^.\s]\w)+/gi)
    .join("")
    .toLowerCase();
  const separator = ".";
  return result.startsWith(separator) ? result : `${separator}${result}`;
};
