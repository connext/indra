import { EIP712Domain } from "@connext/types";
import { utils } from "ethers";

const { keccak256, toUtf8Bytes, defaultAbiCoder, solidityKeccak256 } = utils;

export const hashString = (str: string) => keccak256(toUtf8Bytes(str));

export const hashTypedMessage = (domainSeparator: string, data: string): string =>
  solidityKeccak256(["string", "bytes32", "bytes32"], ["\x19\x01", domainSeparator, data]);

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

const DOMAIN_TYPE_HASH = hashString(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)",
);

export const hashDomainSeparator = (domain: EIP712Domain) =>
  hashStruct(
    DOMAIN_TYPE_HASH,
    ["string", "string", "uint256", "address", "bytes32"],
    [domain.name, domain.version, domain.chainId, domain.verifyingContract, domain.salt],
  );
