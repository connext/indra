import { EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT, NetworkContext } from "@connext/types";
import { hexlify, randomBytes } from "ethers/utils";

/// todo(xuanji): make this random but deterministically generated from some seed
export function generateRandomNetworkContext(): NetworkContext {
  return EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT.reduce(
    (acc, contractName) => ({
      ...acc,
      [contractName]: createRandomAddress(),
    }),
    {} as NetworkContext,
  );
}

export function createRandomBytesHexString(length: number) {
  return hexlify(randomBytes(length)).toLowerCase();
}

export function createRandomAddress() {
  return createRandomBytesHexString(20);
}

export function createRandom32ByteHexString() {
  return createRandomBytesHexString(32);
}
