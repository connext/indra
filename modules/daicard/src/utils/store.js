import { ConnextClientStorePrefix } from "@connext/types";
import { arrayify, hexlify, keccak256, toUtf8Bytes, toUtf8String } from "ethers/utils";

export const storeFactory = options => {
  const { pisaClient, wallet } = options || { pisaClient: null, wallet: null };
  return {
    get: path => {
      const raw = localStorage.getItem(`${ConnextClientStorePrefix}:${path}`);
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
        for (const k of Object.keys(localStorage)) {
          if (k.includes(`${path}/`)) {
            try {
              partialMatches[
                k.replace(`${ConnextClientStorePrefix}:`, "").replace(`${path}/`, "")
              ] = JSON.parse(localStorage.getItem(k));
            } catch {
              partialMatches[
                k.replace(`${ConnextClientStorePrefix}:`, "").replace(`${path}/`, "")
              ] = localStorage.getItem(k);
            }
          }
        }
        return partialMatches;
      }
      return raw;
    },

    set: async (pairs, shouldBackup) => {
      for (const pair of pairs) {
        localStorage.setItem(
          `${ConnextClientStorePrefix}:${pair.path}`,
          typeof pair.value === "string" ? pair.value : JSON.stringify(pair.value),
        );

        if (
          shouldBackup &&
          pisaClient &&
          pair.path.match(/\/xpub.*\/channel\/0x[0-9a-fA-F]{40}/) &&
          pair.value.freeBalanceAppInstance
        ) {
          try {
            console.log(`Backing up store value at path ${pair.path}`);
            await pisaClient.backUp(
              digest => wallet.signMessage(arrayify(digest)),
              wallet.address,
              hexlify(toUtf8Bytes(JSON.stringify(pair))),
              await wallet.provider.getBlockNumber(),
              keccak256(toUtf8Bytes(pair.path)),
              pair.value.freeBalanceAppInstance.latestVersionNumber,
            );
          } catch (e) {
            // If we get a "nonce too low" error, we'll log & ignore bc sometimes expected. See:
            // see: https://github.com/counterfactual/monorepo/issues/2497
            if (e.message && e.message.match(/Appointment already exists and nonce too low./)) {
              console.warn(e);
            } else {
              console.error(e);
            }
          }
        }
      }
    },

    reset: () => {
      // TODO: Should we also scrub legacy channel prefixes?
      const channelPrefix = `${ConnextClientStorePrefix}:${ConnextClientStorePrefix}/`
      // get all keys in local storage that match prefix
      Object.entries(localStorage).forEach(([key, value]) => {
        if (key.includes(channelPrefix)) {
          console.log(`removing item: ${key}`)
          localStorage.removeItem(key)
        }
      })
      localStorage.removeItem(`${ConnextClientStorePrefix}:EXTENDED_PRIVATE_KEY`);
    },

    restore: async () => {
      return pisaClient
        ? (await pisaClient.restore(
            digest => wallet.signMessage(arrayify(digest)),
            wallet.address,
            await wallet.provider.getBlockNumber(),
          )).map(b => JSON.parse(toUtf8String(arrayify(b.data))))
        : [];
    },
  };
};
