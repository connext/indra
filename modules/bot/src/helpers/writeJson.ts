import { safeJsonStringify } from "@connext/utils";
import { mkdirSync, writeFile } from "fs";
import { dirname } from "path";

export const writeJson = (json: any, path: string) => {
  // make directory
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  // write file
  const data = safeJsonStringify(json);
  return writeFile(dir, data, (error) => {
    if (error) {
      throw error;
    }
  });
};
