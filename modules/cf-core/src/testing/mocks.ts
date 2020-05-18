import { EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT, NetworkContext } from "@connext/types";
import { getRandomAddress } from "@connext/utils";
import { utils } from "ethers";

const { getAddress } = utils;

/// todo(xuanji): make this random but deterministically generated from some seed
export function generateRandomNetworkContext(): NetworkContext {
  return EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT.reduce(
    (acc, contractName) => ({
      ...acc,
      [contractName]: getAddress(getRandomAddress()),
    }),
    {} as NetworkContext,
  );
}
