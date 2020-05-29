import { Contract, ContractFactory, Wallet } from "ethers";
import { keccak256 } from "ethers/utils";

import { AddressBook } from "./address-book";
import { artifacts } from "./artifacts";

export const deployContract = async (
  name: string,
  args: Array<{ name: string; value: string }>,
  wallet: Wallet,
  addressBook: AddressBook,
): Promise<Contract> => {
  console.log(`\nChecking for valid ${name} contract...`);

  const hash = (input: string): string => keccak256(`0x${input.replace(/^0x/, "")}`);

  // Simple sanity checks to make sure contracts from our address book have been deployed
  const contractIsDeployed = async (
    name: string,
    address: string | undefined,
    artifact: any,
  ): Promise<boolean> => {
    if (!address || address === "") {
      console.log("This contract is not in our address book.");
      return false;
    }
    const savedCreationCodeHash = addressBook.getEntry(name).creationCodeHash;
    const creationCodeHash = hash(artifacts[name].bytecode);
    if (!savedCreationCodeHash || savedCreationCodeHash !== creationCodeHash) {
      console.log(`creationCodeHash in our address book doen't match ${name} artifacts`);
      console.log(`${savedCreationCodeHash} !== ${creationCodeHash}`);
      return false;
    }
    const savedRuntimeCodeHash = addressBook.getEntry(name).runtimeCodeHash;
    const runtimeCodeHash = hash(await wallet.provider.getCode(address));
    if (runtimeCodeHash === hash("0x00") || runtimeCodeHash === hash("0x")) {
      console.log("No runtimeCode exists at the address in our address book");
      return false;
    }
    if (savedRuntimeCodeHash !== runtimeCodeHash) {
      console.log(`runtimeCodeHash for ${address} does not match what's in our address book`);
      console.log(`${savedRuntimeCodeHash} !== ${runtimeCodeHash}`);
      return false;
    }
    return true;
  };

  const savedAddress = addressBook.getEntry(name).address;
  if (await contractIsDeployed(name, savedAddress, artifacts[name])) {
    console.log(`${name} is up to date, no action required\nAddress: ${savedAddress}`);
    return new Contract(savedAddress!, artifacts[name].abi, wallet);
  }
  const factory = ContractFactory.fromSolidity(artifacts[name]);
  const contract = await factory.connect(wallet).deploy(...args.map((a) => a.value));
  const txHash = contract.deployTransaction.hash;
  console.log(`Sent transaction to deploy ${name}, txHash: ${txHash}`);
  await wallet.provider.waitForTransaction(txHash!);
  const address = contract.address;
  console.log(`${name} has been deployed to address: ${address}`);
  const runtimeCodeHash = hash(await wallet.provider.getCode(address));
  const creationCodeHash = hash(artifacts[name].bytecode);
  addressBook.setEntry(name, {
    address,
    constructorArgs: args,
    creationCodeHash,
    runtimeCodeHash,
    txHash,
  });

  return contract;
};
