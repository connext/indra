import { SigningKey } from "ethers/utils";
import { createRandom32ByteHexString, getPublicIdentifier } from "@connext/types";

import { ChannelSigner } from "@connext/crypto";
import { Wallet } from "ethers";
import { GANACHE_CHAIN_ID } from "./utils";

export function getRandomSigningKeys(length: number) {
  return Array(length)
    .fill(0)
    .map(_ => new SigningKey(createRandom32ByteHexString()));
}

export function getRandomChannelSigner(provider?: string): ChannelSigner {
  return new ChannelSigner(Wallet.createRandom().privateKey, provider);
}

export function getRandomChannelSigners(length: number, provider?: string): ChannelSigner[] {
  return Array(length)
    .fill(0)
    .map(() => getRandomChannelSigner(provider));
}

export function getRandomPublicIdentifiers(length: number, provider?: string): string[] {
  return getRandomChannelSigners(length, provider)
    .map((signer) => getPublicIdentifier(GANACHE_CHAIN_ID, signer.address));
}

