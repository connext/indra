import fs from "fs";

import { config } from "./config";

let storeObj;
export const store = {
  get: (path: string): any => {
    if (!storeObj) {
      storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    const raw = storeObj[`CF_NODE:${path}`];
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
      for (const k of Object.keys(storeObj)) {
        if (k.includes(`${path}/`)) {
          try {
            partialMatches[k.replace("CF_NODE:", "").replace(`${path}/`, "")] = JSON.parse(
              storeObj[k],
            );
          } catch {
            partialMatches[k.replace("CF_NODE:", "").replace(`${path}/`, "")] = storeObj[k];
          }
        }
      }
      return partialMatches;
    }
    return raw;
  },

  set: async (
    pairs: { path: string; value: any }[],
    allowDelete?: Boolean | undefined,
  ): Promise<void> => {
    if (!storeObj) {
      storeObj = JSON.parse(fs.readFileSync(config.dbFile, "utf8") || "{}");
    }
    for (const pair of pairs) {
      storeObj[`CF_NODE:${pair.path}`] =
        typeof pair.value === "string" ? pair.value : JSON.stringify(pair.value);
    }
    fs.unlinkSync(config.dbFile);
    fs.writeFileSync(config.dbFile, JSON.stringify(storeObj, null, 2));
  },
};
