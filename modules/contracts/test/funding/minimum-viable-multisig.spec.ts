import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { Web3Provider } from "ethers/providers";
import {
  parseEther,
  Interface,
  solidityKeccak256,
  BigNumberish,
  Signature,
  recoverAddress,
  BigNumber,
  joinSignature,
  SigningKey,
  id,
  keccak256,
} from "ethers/utils";

import DolphinCoin from "../../build/DolphinCoin.json";
import MinimumViableMultisig from "../../build/MinimumViableMultisig.json";

import { expect } from "./utils/index";
import { HashZero } from "ethers/constants";

const getHashToSign = (
  domainName: string,
  domainVersion: string,
  chainId: number,
  owners: string[],
  verifyingContract: string,
  domainSalt: string,
  to: string,
  value: BigNumberish,
  data: string,
  operation: number,
  transactionCount: number,
) => {
  const domainSeparatorHash = getDomainSeparatorHash(
    domainName,
    domainVersion,
    chainId,
    verifyingContract,
    domainSalt,
  );
  return solidityKeccak256(
    ["bytes1", "address[]", "address", "uint256", "bytes32", "uint8", "bytes32", "uint256"],
    ["0x19", owners, to, value, keccak256(data), operation, domainSeparatorHash, transactionCount],
  );
};

const getDomainSeparatorHash = (
  domainName: string,
  domainVersion: string,
  chainId: number,
  verifyingContract: string,
  domainSalt: string,
) => {
  return solidityKeccak256(
    ["bytes32", "bytes32", "uint256", "address", "bytes32"],
    [id(domainName), id(domainVersion), chainId, verifyingContract, domainSalt],
  );
};

const sortSignaturesBySignerAddress = (digest: string, signatures: Signature[]): Signature[] => {
  const ret = signatures.slice();
  ret.sort((sigA, sigB) => {
    const addrA = recoverAddress(digest, signaturesToBytes(sigA));
    const addrB = recoverAddress(digest, signaturesToBytes(sigB));
    return new BigNumber(addrA).lt(addrB) ? -1 : 1;
  });
  return ret;
};

const signaturesToBytes = (...signatures: Signature[]): string => {
  return signatures
    .map(joinSignature)
    .map(s => s.substr(2))
    .reduce((acc, v) => acc + v, "0x");
};

describe("MinimumViableMultisig", () => {
  let provider: Web3Provider;
  let wallet0: Wallet;
  let wallet1: Wallet;
  let multisig: Contract;
  let erc20: Contract;

  before(async () => {
    provider = waffle.createMockProvider();
    const wallets = waffle.getWallets(provider);
    wallet0 = wallets[0];
    wallet1 = wallets[1];

    multisig = await waffle.deployContract(wallet0, MinimumViableMultisig);
    await multisig.functions.setup([wallet0.address, wallet1.address]);
    const owners = await multisig.functions.getOwners();
    expect(owners[0]).to.be.eq(wallet0.address);
    expect(owners[1]).to.be.eq(wallet1.address);

    erc20 = await waffle.deployContract(wallet0, DolphinCoin);
  });

  it.only("allows the multisig to execute a transaction", async () => {
    await erc20.functions.transfer(multisig.address, parseEther("0.1"));
    let balance = await erc20.functions.balanceOf(multisig.address);
    expect(balance).to.eq(parseEther("0.1"));

    const txData = new Interface(DolphinCoin.abi).functions.transfer.encode([
      wallet1.address,
      parseEther("0.1"),
    ]);

    const hashToSign = getHashToSign(
      "Test Domain",
      "0.0.1",
      4447,
      [wallet0.address, wallet1.address],
      multisig.address,
      HashZero,
      erc20.address,
      "0",
      txData,
      0,
      0,
    );

    const signingKey0 = new SigningKey(wallet0.privateKey);
    const signingKey1 = new SigningKey(wallet1.privateKey);
    const sig0 = signingKey0.signDigest(hashToSign);
    const sig1 = signingKey1.signDigest(hashToSign);

    await multisig.functions.execTransaction(
      erc20.address, // to
      "0", // value
      txData, // data
      0, // operation
      "Test Domain",
      "0.0.1",
      4447,
      HashZero,
      0,
      sortSignaturesBySignerAddress(hashToSign, [sig0, sig1]).map(joinSignature),
    );

    balance = await erc20.functions.balanceOf(multisig.address);
    expect(balance).to.eq(0);

    balance = await erc20.functions.balanceOf(wallet1.address);
    expect(balance).to.eq(parseEther("0.1"));
  });
});
