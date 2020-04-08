import { SigningKey } from "ethers/utils";
import { createRandom32ByteHexString } from "@connext/types";

import { ChannelSigner } from "@connext/crypto";
import { Wallet } from "ethers";
import { GANACHE_CHAIN_ID } from "./utils";

export function getRandomSigningKeys(length: number) {
  return Array(length)
    .fill(0)
    .map(_ => new SigningKey(createRandom32ByteHexString()));
}

export function getRandomChannelSigner(): ChannelSigner {
  return new ChannelSigner(
    Wallet.createRandom().privateKey,
    GANACHE_CHAIN_ID,
  );
}

export function getRandomChannelSigners(length: number): ChannelSigner[] {
  return Array(length)
    .fill(0)
    .map(getRandomChannelSigner);
}

export function getRandomChannelIdentifiers(length: number): string[] {
  return getRandomChannelSigners(length)
    .map((signer) => signer.identifier);
}

