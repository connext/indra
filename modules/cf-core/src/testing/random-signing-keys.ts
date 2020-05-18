import { IChannelSigner } from "@connext/types";
import { getRandomBytes32, getRandomChannelSigner } from "@connext/utils";
import { utils } from "ethers";

const { SigningKey } = utils;

export function getRandomSigningKeys(length: number) {
  return Array(length)
    .fill(0)
    .map((_) => new SigningKey(getRandomBytes32()));
}

export function getRandomChannelSigners(length: number, ethProviderUrl?: string): IChannelSigner[] {
  return Array(length)
    .fill(0)
    .map(() => getRandomChannelSigner(ethProviderUrl));
}

export function getRandomPublicIdentifier(provider?: string) {
  const [ret] = getRandomPublicIdentifiers(1, provider);
  return ret;
}

export function getRandomPublicIdentifiers(length: number, provider?: string): string[] {
  return getRandomChannelSigners(length, provider).map((signer) => signer.publicIdentifier);
}
