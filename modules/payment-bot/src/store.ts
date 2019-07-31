import fs from "fs";

import { config } from "./config";

let storeObj;
export const store = {
  get: (key: string): any => {
    if (!storeObj) {
      storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    const raw = storeObj[key];
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    // Handle partial matches so the following line works -.-
    // https://github.com/counterfactual/monorepo/blob/master/packages/node/src/store.ts#L54
    if (key.endsWith("channel") || key.endsWith("appInstanceIdToProposedAppInstance")) {
      const partialMatches = {};
      for (const k of Object.keys(storeObj)) {
        if (k.includes(`${key}/`)) {
          try {
            partialMatches[k.replace(`${key}/`, "")] = JSON.parse(storeObj[k]);
          } catch {
            partialMatches[k.replace(`${key}/`, "")] = storeObj[k];
          }
        }
      }
      return partialMatches;
    }
    return raw;
  },

  set: async (
    pairs: { key: string; value: any }[],
    allowDelete?: Boolean | undefined,
  ): Promise<void> => {
    if (!storeObj) {
      storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    for (const pair of pairs) {
      storeObj[pair.key] = typeof pair.value === "string" ? pair.value : JSON.stringify(pair.value);
    }
    fs.unlinkSync(config.dbFile);
    fs.writeFileSync(config.dbFile, JSON.stringify(storeObj, null, 2));
  },
};
