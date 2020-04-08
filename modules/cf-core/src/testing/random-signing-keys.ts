import { HDNode, SigningKey } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";
import { createRandom32ByteHexString } from "@connext/types";

import { computeRandomExtendedPrvKey } from "../xkeys";

export function getRandomSigningKeys(length: number) {
  return Array(length)
    .fill(0)
    .map(_ => new SigningKey(createRandom32ByteHexString()));
}

export function extendedPrvKeyToExtendedPubKey(extendedPrvKey: string): string {
  return fromExtendedKey(extendedPrvKey).neuter().extendedKey;
}

export function getRandomExtendedPubKey(): string {
  return extendedPrvKeyToExtendedPubKey(computeRandomExtendedPrvKey());
}

export function getRandomExtendedPubKeys(length: number): string[] {
  return Array(length)
    .fill(0)
    .map(getRandomExtendedPubKey);
}

export function getRandomExtendedPrvKeys(length: number): string[] {
  return Array(length)
    .fill(0)
    .map(computeRandomExtendedPrvKey);
}

export function getRandomHDNodes(length: number): HDNode.HDNode[] {
  return getRandomExtendedPrvKeys(length).map(x => fromExtendedKey(x));
}
