import { expect, MockBackupService, createConnextStore, env } from "../util";
import {
  StoreTypes,
  ASYNCSTORAGE,
  StoreType,
  StateChannelJSON,
  MEMORYSTORAGE,
} from "@connext/types";

describe("ConnextStore", () => {
  const fileDir = env.storeDir;
  describe("getStateChannel", async () => {
    for (const type of Object.keys(StoreTypes)) {
      if (type === ASYNCSTORAGE) {
        continue;
      }
      it(`${type} should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const multisigAddress = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";
        await store.saveStateChannel({ multisigAddress } as StateChannelJSON);
        const expected = {
          multisigAddress,
        };
        const retrieved = await store.getStateChannel(multisigAddress);
        expect(retrieved).to.deep.equal(expected);
        await store.clear();
      });
    }
  });

  describe("clear", () => {
    for (const type of Object.keys(StoreTypes)) {
      if (type === ASYNCSTORAGE) {
        continue;
      }

      it(`${type} should work`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const multisigAddress = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";
        await store.saveStateChannel({ multisigAddress } as any);
        const retrieved = await store.getStateChannel(multisigAddress);
        expect(retrieved).to.deep.equal({ multisigAddress });
        await store.clear();
        expect(await store.getStateChannel(multisigAddress)).to.deep.equal(undefined);
      });
    }
  });

  describe("restore", () => {
    for (const type of Object.keys(StoreTypes)) {
      if (type === ASYNCSTORAGE) {
        continue;
      }

      it(`${type} should restore empty state when not provided with a backup service`, async () => {
        const store = createConnextStore(type as StoreType, { fileDir });
        const multisigAddress = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";
        await store.saveStateChannel({ multisigAddress } as any);
        const retrieved = await store.getStateChannel(multisigAddress);
        expect(retrieved).to.deep.equal({ multisigAddress });

        await expect(store.restore()).to.be.rejectedWith(`No backup provided, store cleared`);
        expect(await store.getStateChannel(multisigAddress)).to.deep.equal(undefined);
        await store.clear();
      });

      if (type === MEMORYSTORAGE) {
        continue;
      }
      it(`${type} should backup state when provided with a backup service`, async () => {
        const backupService = new MockBackupService();
        const store = createConnextStore(type as StoreType, { backupService, fileDir });
        const multisigAddress = "0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4b";
        await store.saveStateChannel({ multisigAddress } as any);
        const retrieved = await store.getStateChannel(multisigAddress);
        expect(retrieved).to.deep.equal({ multisigAddress });
        await store.restore();
        expect(await store.getStateChannel(multisigAddress)).to.deep.equal({ multisigAddress });
        await store.clear();
      });
    }
  });
});
