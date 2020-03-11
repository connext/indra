import { CF_PATH } from "@connext/types";
import { Wallet } from "ethers";
import { BigNumber } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";
import { Memoize } from "typescript-memoize";

import { CFCoreTypes } from "./types";

export class PrivateKeysGetter {
  private appInstanceIdentityHashToPrivateKey: Map<string, string> = new Map();
  private readonly privateKeys: Set<string> = new Set();

  constructor(private readonly privateKeyGenerator: CFCoreTypes.IPrivateKeyGenerator) {}

  @Memoize()
  public async getPrivateKey(appInstanceIdentityHash: string): Promise<string> {
    const validHDPathRepresentationOfIdentityHash = convertDecimalStringToValidHDPath(
      new BigNumber(appInstanceIdentityHash).toString(),
    );

    if (this.appInstanceIdentityHashToPrivateKey.has(validHDPathRepresentationOfIdentityHash)) {
      return await this.appInstanceIdentityHashToPrivateKey.get(
        validHDPathRepresentationOfIdentityHash,
      )!;
    }

    const privateKey = await this.privateKeyGenerator(validHDPathRepresentationOfIdentityHash);
    try {
      new Wallet(privateKey);
    } catch (e) {
      throw new Error(`
        Invalid private key retrieved from wallet-provided
        callback given AppInstance ID ${appInstanceIdentityHash}: ${JSON.stringify(e, null, 4)}
      `);
    }

    if (this.privateKeys.has(privateKey)) {
      throw new Error(
        "Wallet-provided callback function returned a colliding private key for two different AppInstance IDs",
      );
    }

    this.appInstanceIdentityHashToPrivateKey = this.appInstanceIdentityHashToPrivateKey.set(
      validHDPathRepresentationOfIdentityHash,
      privateKey,
    );
    this.privateKeys.add(privateKey);

    return privateKey;
  }
}

export async function getPrivateKeysGeneratorAndXPubOrThrow(
  storeService: CFCoreTypes.IStoreService,
  privateKeyGenerator?: CFCoreTypes.IPrivateKeyGenerator,
  publicExtendedKey?: string,
): Promise<[PrivateKeysGetter, string]> {
  if (!privateKeyGenerator) {
    throw new Error("A private key generator function is required");
  }

  if (!publicExtendedKey) {
    throw new Error("An extended public key is required");
  }

  return Promise.resolve([new PrivateKeysGetter(privateKeyGenerator!), publicExtendedKey!]);
}

// Reference implementation for how the `IPrivateKeyGenerator` interface
// should be implemented, with specific reference to hardcoding the
// "Counterfactual" derivation path.
export function generatePrivateKeyGeneratorAndXPubPair(
  extendedPrvKey: string,
): [CFCoreTypes.IPrivateKeyGenerator, string] {
  const hdNode = fromExtendedKey(extendedPrvKey).derivePath(CF_PATH);

  return [
    function(uniqueID: string): Promise<string> {
      return Promise.resolve(hdNode.derivePath(uniqueID).privateKey);
    },
    hdNode.neuter().extendedKey,
  ];
}

/**
 * Given a decimal representation of a hex string such as
 * "61872445784447517153266591489987994343175816860517849584947754093871275612211",
 * this function would produce
 * "6187244578/4447517153/2665914899/8799434317/5816860517/8495849477/5409387127/5612211"
 */
function convertDecimalStringToValidHDPath(numbers: string): string {
  const components = numbers.split("").reduce(
    (componentAccumulator: [string[]], number: string, index) => {
      if (index === 0) {
        return componentAccumulator;
      }
      if (index % 10 === 0) {
        componentAccumulator.push([number]);
      } else {
        componentAccumulator[componentAccumulator.length - 1].push(number);
      }
      return componentAccumulator;
    },
    [[numbers[0]]],
  );

  return components.map((component: string[]) => component.join("")).join("/");
}
