import { fromExtendedKey, HDNode } from "ethers/utils/hdnode";

import { CF_PATH } from "./constants";
import { computeRandomExtendedPrvKey } from "./machine/xkeys";
import { CFCoreTypes } from "./types";

export const EXTENDED_PRIVATE_KEY_PATH = "EXTENDED_PRIVATE_KEY";

export async function getHDNode(storeService: CFCoreTypes.IStoreService): Promise<HDNode> {
  let xprv = await storeService.getExtendedPrvKey();

  if (!xprv) {
    xprv = computeRandomExtendedPrvKey();
    await storeService.saveExtendedPrvKey(xprv);
  }

  try {
    return fromExtendedKey(xprv).derivePath(CF_PATH);
  } catch (e) {
    throw Error(`Invalid extended key supplied: ${e.message}`);
  }
}
