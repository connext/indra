import { ConnextClientStorePrefix } from "@connext/types";

export const store = {
  get: (path) => {
    const raw = localStorage.getItem(`${ConnextClientStorePrefix}:${path}`)
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
      const partialMatches = {}
      for (const k of Object.keys(localStorage)) {
        if (k.includes(`${path}/`)) {
          try {
            partialMatches[k.replace(`${ConnextClientStorePrefix}:`, '').replace(`${path}/`, '')] = JSON.parse(localStorage.getItem(k))
          } catch {
            partialMatches[k.replace(`${ConnextClientStorePrefix}:`, '').replace(`${path}/`, '')] = localStorage.getItem(k)
          }
        }
      }
      return partialMatches;
    }
    return raw;
  },
  set: (pairs, allowDelete) => {
    for (const pair of pairs) {
      localStorage.setItem(
        `${ConnextClientStorePrefix}:${pair.path}`,
        typeof pair.value === 'string' ? pair.value : JSON.stringify(pair.value),
      );
    }
  },
  reset: () => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(ConnextClientStorePrefix)) {
        localStorage.removeItem(k);
      }
    }
  }
};
