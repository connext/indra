import { AssetId, AppIdentity } from "@connext/types";
import { getAddress, keccak256, solidityPack } from "ethers/utils";

////////////////////////////////////////
// AssetId

// make sure all addresses are normalized
export const getAddressFromAssetId = (assetId: AssetId): string =>
  getAddress(assetId);

export function appIdentityToHash(appIdentity: AppIdentity): string {
  return keccak256(
    solidityPack(
      ["address", "uint256", "bytes32", "address", "uint256"],
      [
        appIdentity.multisigAddress,
        appIdentity.channelNonce,
        keccak256(solidityPack(["address[]"], [appIdentity.participants])),
        appIdentity.appDefinition,
        appIdentity.defaultTimeout,
      ],
    ),
  );
}