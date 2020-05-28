import * as tokenArtifacts from "@openzeppelin/contracts/build/contracts/ERC20Mintable.json";
import { Contract, ContractFactory, Wallet } from "ethers";
import { EtherSymbol } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { keccak256, formatEther } from "ethers/utils";
import fs from "fs";
import { Argv } from "yargs";

import { classicProviders, ganacheId } from "../constants";
import {
  ChallengeRegistry,
  ConditionalTransactionDelegateTarget,
  DepositApp,
  HashLockTransferApp,
  IdentityApp,
  MinimumViableMultisig,
  MultiAssetMultiPartyCoinTransferInterpreter,
  ProxyFactory,
  SimpleLinkedTransferApp,
  SimpleSignedTransferApp,
  SimpleTransferApp,
  SimpleTwoPartySwapApp,
  SingleAssetTwoPartyCoinTransferInterpreter,
  TimeLockedPassThrough,
  TwoPartyFixedOutcomeInterpreter,
  WithdrawApp,
} from "../index";

const artifacts = {
  ChallengeRegistry,
  ConditionalTransactionDelegateTarget,
  DepositApp,
  HashLockTransferApp,
  IdentityApp,
  MinimumViableMultisig,
  MultiAssetMultiPartyCoinTransferInterpreter,
  ProxyFactory,
  SimpleLinkedTransferApp,
  SimpleSignedTransferApp,
  SimpleTransferApp,
  SimpleTwoPartySwapApp,
  SingleAssetTwoPartyCoinTransferInterpreter,
  TimeLockedPassThrough,
  TwoPartyFixedOutcomeInterpreter,
  WithdrawApp,
};

export type AddressBook = {
  [chainId: string]: {
    [contractName: string]: {
      address: string;
      creationCodeHash?: string;
      runtimeCodeHash?: string;
      txHash?: string;
    }
  }
}

export const migrate = async (wallet: Wallet, addressBookPath: string): Promise<void> => {

  ////////////////////////////////////////
  // Environment Setup

  const addressBook = JSON.parse(fs.readFileSync(addressBookPath, "utf8") || "{}") as AddressBook;
  const balance = await wallet.getBalance();
  const chainId = (await wallet.provider.getNetwork()).chainId; // saved to global scope
  const nonce = await wallet.getTransactionCount();

  console.log(`\nPreparing to migrate contracts to chain w id: ${chainId}`);
  console.log(`Deployer Wallet: address=${wallet.address} nonce=${nonce} balance=${formatEther(balance)}`);

  ////////////////////////////////////////
  // Helper Functions

  const hash = (input: string): string => keccak256(`0x${input.replace(/^0x/, "")}`);

  const getSavedData = (contractName: string, property: "address" | "creationCodeHash" | "runtimeCodeHash" | "txHash"): string | undefined => {
    try {
      return addressBook[chainId][contractName][property];
    } catch (e) {
      return undefined;
    }
  };

  // Write addressBook to disk
  const saveAddressBook = (addressBook: AddressBook): void => {
    try {
      fs.writeFileSync(addressBookPath, JSON.stringify(addressBook, null, 2));
    } catch (e) {
      console.log(`Error saving artifacts: ${e}`);
    }
  };

  // Simple sanity checks to make sure contracts from our address book have been deployed
  const contractIsDeployed = async (
    name: string,
    address: string | undefined,
    artifacts: any,
  ): Promise<boolean> => {
    if (!address || address === "") {
      console.log("This contract is not in our address book.");
      return false;
    }
    const savedCreationCodeHash = getSavedData(name, "creationCodeHash");
    const creationCodeHash = hash(artifacts.bytecode);
    if (!savedCreationCodeHash || savedCreationCodeHash !== creationCodeHash) {
      console.log(`creationCodeHash in our address book doen't match ${name} artifacts`);
      console.log(`${savedCreationCodeHash} !== ${creationCodeHash}`);
      return false;
    }
    const savedRuntimeCodeHash = getSavedData(name, "runtimeCodeHash");
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

  const deployContract = async (
    name: string,
    artifacts: any,
    args: Array<{ name: string; value: string }>,
  ): Promise<Contract> => {
    console.log(`\nChecking for valid ${name} contract...`);
    const savedAddress = getSavedData(name, "address");
    if (await contractIsDeployed(name, savedAddress, artifacts)) {
      console.log(`${name} is up to date, no action required\nAddress: ${savedAddress}`);
      return new Contract(savedAddress!, artifacts.abi, wallet);
    }
    const factory = ContractFactory.fromSolidity(artifacts);
    const contract = await factory.connect(wallet).deploy(...args.map((a) => a.value));
    const txHash = contract.deployTransaction.hash;
    console.log(`Sent transaction to deploy ${name}, txHash: ${txHash}`);
    await wallet.provider.waitForTransaction(txHash!);
    const address = contract.address;
    console.log(`${name} has been deployed to address: ${address}`);
    const runtimeCodeHash = hash(await wallet.provider.getCode(address));
    const creationCodeHash = hash(artifacts.bytecode);
    // Update address-book w new address + the args we deployed with
    const saveArgs = {} as any;
    args.forEach((a) => (saveArgs[a.name] = a.value));
    if (!addressBook[chainId]) {
      addressBook[chainId] = {};
    }
    addressBook[chainId][name] = {
      address,
      creationCodeHash,
      runtimeCodeHash,
      txHash,
      ...saveArgs,
    };
    saveAddressBook(addressBook);
    return contract;
  };

  ////////////////////////////////////////
  // Deploy contracts

  for (const [name, artifact] of Object.entries(artifacts)) {
    await deployContract(name, artifact, []);
  }

  // If this network has no token yet, deploy one
  if (chainId === ganacheId || !getSavedData("Token", "address")) {
    await deployContract("Token", tokenArtifacts, []);
  }

  ////////////////////////////////////////
  // Print summary

  console.log("\nAll done!");
  const spent = formatEther(balance.sub(await wallet.getBalance()));
  const nTx = (await wallet.getTransactionCount()) - nonce;
  console.log(`Sent ${nTx} transaction${nTx === 1 ? "" : "s"} & spent ${EtherSymbol} ${spent}`);
};

export const migrateCommand = {
  command: "migrate",
  describe: "Migrate contracts",
  builder: (yargs: Argv) => {
    return yargs
      .option("mnemonic", {
        description: "The mnemonic for an account which will pay gas costs",
        type: "string",
      })
      .option("eth-provider", {
        description: "The URL of a provider for the target Ethereum network",
        type: "string",
      })
      .option("address-book", {
        description: "The path to your address-book.json file",
        type: "string",
        default: "./address-book.json",
      })
      .demandOption(["mnemonic", "eth-provider"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await migrate(
      Wallet.fromMnemonic(argv.mnemonic).connect(
        new JsonRpcProvider(
          argv.ethProvider,
          classicProviders.includes(argv.ethProvider) ? "classic" : undefined,
        ),
      ),
      argv.addressBook,
    );
  },
};
