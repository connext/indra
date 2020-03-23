import { EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT, NetworkContext } from "@connext/types";
import { hexlify, randomBytes } from "ethers/utils";
import { getLowerCaseAddress } from "@connext/crypto";

/// todo(xuanji): make this random but deterministically generated from some seed
export function generateRandomNetworkContext(): NetworkContext {
  return EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT.reduce(
    (acc, contractName) => ({
      ...acc,
      [contractName]: getLowerCaseAddress(hexlify(randomBytes(20))),
    }),
    {} as NetworkContext,
  );
}
