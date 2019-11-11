import { AppIdentity } from "@connext/cf-types";
import { defaultAbiCoder, keccak256 } from "ethers/utils";

export function appIdentityToHash(appIdentity: AppIdentity) {
  return keccak256(
    defaultAbiCoder.encode(
      ["uint256", "address[]"],
      [appIdentity.channelNonce, appIdentity.participants]
    )
  );
}
