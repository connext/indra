import { utils } from "ethers";
import { EIP712Domain } from "@connext/types";

const { keccak256, toUtf8Bytes, defaultAbiCoder, solidityKeccak256 } = utils;

export const hashString = (str: string) => keccak256(toUtf8Bytes(str));

export const hashTypedMessage = (domainSeparator: string, messageHash: string): string =>
  solidityKeccak256(["string", "bytes32", "bytes32"], ["\x19\x01", domainSeparator, messageHash]);

export const hashStruct = (typeHash: string, types: string[], values: any[]) => {
  types.forEach((type, i) => {
    if (["string", "bytes"].includes(type)) {
      types[i] = "bytes32";
      if (type === "string") {
        values[i] = hashString(values[i]);
      } else {
        values[i] = keccak256(values[i]);
      }
    }
  });
  return keccak256(defaultAbiCoder.encode(["bytes32", ...types], [typeHash, ...values]));
};

export const DOMAIN_TYPE_HASH = hashString(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)",
);

export const hashDomainSeparator = (
  domainName: string,
  domainVersion: string,
  chainId: number,
  verifyingContract: string,
  domainSalt: string,
) =>
  hashStruct(
    DOMAIN_TYPE_HASH,
    ["string", "string", "uint256", "address", "bytes32"],
    [domainName, domainVersion, chainId, verifyingContract, domainSalt],
  );

export const getTestEIP712Domain = (chainId: number): EIP712Domain => ({
  name: "Test EIP712 Domain",
  version: "0",
  chainId,
  verifyingContract: "0x1d85568eEAbad713fBB5293B45ea066e552A90De",
  salt: "0xa070ffb1cd7409649bf77822cce74495468e06dbfaef09556838bf188679b9c2",
});
