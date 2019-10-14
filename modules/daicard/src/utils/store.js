import { ConnextClientStorePrefix } from "@connext/types";
import { arrayify, hexlify, keccak256, toUtf8Bytes, toUtf8String } from "ethers/utils";
const pisaPathRegex = /.*\/xpub.*\/channel\/0x[0-9a-fA-F]{40}/;
const pisaNonceTooLowRegex = /Appointment already exists and nonce too low. Should be greater than (\d+)\./;

const restoreFromPisa = async (pisaClient, provider, wallet) => {
  const currentBlockNumber = await provider.getBlockNumber();
  const restoreStates = await pisaClient.restore(
    digest => wallet.signMessage(arrayify(digest)),
    wallet.address,
    currentBlockNumber,
  );

  const parsedRestoreStates = restoreStates.map(b => JSON.parse(toUtf8String(arrayify(b.data))));
  return parsedRestoreStates;
};

const backupToPisa = async (pisaClient, provider, wallet, path, data, version) => {
  let stringed;
  try {
    // stringify the data
    stringed = JSON.stringify(data);
    const bytes = toUtf8Bytes(stringed);
    const hex = hexlify(bytes);
    const currentBlockNumber = await provider.getBlockNumber();
    await pisaClient.backup(
      digest => wallet.signMessage(arrayify(digest)),
      wallet.address,
      hex,
      currentBlockNumber,
      keccak256(toUtf8Bytes(path)),
      version,
    );
  } catch (doh) {
    // if the error message matches the "nonce too low" regex we'll swallow
    // as this is potentially expected behaviour
    // see: https://github.com/counterfactual/monorepo/issues/2497
    if (doh.message) {
      const matches = doh.message.match(pisaNonceTooLowRegex);
      if (matches && Number.parseInt(matches[1], 10) === version) {
        console.error(doh);
        console.error(stringed);
        return;
      }
    }
    throw doh;
  }
};

export const storeFactory = pisaOptions => {
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
    set: async (pairs, allowDelete, updatePisa = true) => {
      for (const pair of pairs) {
        localStorage.setItem(
          `${ConnextClientStorePrefix}:${pair.path}`,
          typeof pair.value === "string" ? pair.value : JSON.stringify(pair.value),
        );

        if (
          pisaOptions &&
          updatePisa &&
          pisaPathRegex.exec(pair.path) &&
          pair.value.freeBalanceAppInstance
        ) {
          // although the call to pisa is async we dont await it here to avoid the ui waiting on network
          // requests, besides there is little benefit the UI can add here
          const version = pair.value.freeBalanceAppInstance.latestVersionNumber;
          await backupToPisa(
            pisaOptions.pisaClient,
            pisaOptions.provider,
            pisaOptions.wallet,
            pair.path,
            pair,
            version,
          );
        }
      }
    },
    reset: wallet => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(ConnextClientStorePrefix)) {
          localStorage.removeItem(k);
        }
      }

      if (pisaOptions && wallet) pisaOptions.wallet = wallet;
    },
    restore: async () => {
      if (pisaOptions) {
        return await restoreFromPisa(
          pisaOptions.pisaClient,
          pisaOptions.provider,
          pisaOptions.wallet,
        );
      }
      return [];
    },
  };
};
