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

export function getRandomChannelSigner(): ChannelSigner {
  return new ChannelSigner(
    Wallet.createRandom().privateKey,
    GANACHE_CHAIN_ID,
  );
}

export function getRandomChannelIdentifiers(length: number): string[] {
  return Array(length)
    .fill(getRandomChannelSigner)
    .map(
      (signer: ChannelSigner) => getPublicIdentifier(GANACHE_CHAIN_ID, signer.address),
    );
}

