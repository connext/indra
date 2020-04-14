import { AssetId } from "@connext/types";
import { getAddress } from "ethers/utils";

////////////////////////////////////////
// AssetId

// make sure all addresses are normalized
export const getAddressFromAssetId = (assetId: AssetId): string =>
  getAddress(assetId);

