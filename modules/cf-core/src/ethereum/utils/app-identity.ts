import { defaultAbiCoder, keccak256 } from "ethers/utils";

import { AppIdentity } from "../../types";

export function appIdentityToHash(appIdentity: AppIdentity): string {
  return keccak256(
    defaultAbiCoder.encode(
      ["uint256", "address[]"],
      [appIdentity.channelNonce, appIdentity.participants]
    )
  );
}
