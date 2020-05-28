import * as tokenArtifacts from "@openzeppelin/contracts/build/contracts/ERC20Mintable.json";
import { Contract, ContractFactory, Wallet } from "ethers";
import { EtherSymbol, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { keccak256, formatEther, parseEther } from "ethers/utils";
import fs from "fs";
import { Argv } from "yargs";

import * as ChallengeRegistry from "../artifacts/ChallengeRegistry.json";
import * as ConditionalTransactionDelegateTarget from "../artifacts/ConditionalTransactionDelegateTarget.json";
import * as DepositApp from "../artifacts/DepositApp.json";
import * as HashLockTransferApp from "../artifacts/HashLockTransferApp.json";
import * as IdentityApp from "../artifacts/IdentityApp.json";
import * as MinimumViableMultisig from "../artifacts/MinimumViableMultisig.json";
import * as MultiAssetMultiPartyCoinTransferInterpreter from "../artifacts/MultiAssetMultiPartyCoinTransferInterpreter.json";
import * as ProxyFactory from "../artifacts/ProxyFactory.json";
import * as SimpleLinkedTransferApp from "../artifacts/SimpleLinkedTransferApp.json";
import * as SimpleSignedTransferApp from "../artifacts/SimpleSignedTransferApp.json";
import * as SimpleTransferApp from "../artifacts/SimpleTransferApp.json";
import * as SimpleTwoPartySwapApp from "../artifacts/SimpleTwoPartySwapApp.json";
import * as SingleAssetTwoPartyCoinTransferInterpreter from "../artifacts/SingleAssetTwoPartyCoinTransferInterpreter.json";
import * as TimeLockedPassThrough from "../artifacts/TimeLockedPassThrough.json";
import * as TwoPartyFixedOutcomeInterpreter from "../artifacts/TwoPartyFixedOutcomeInterpreter.json";
import * as WithdrawApp from "../artifacts/WithdrawApp.json";

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

const classicProviders = ["https://www.ethercluster.com/etc"];

const botMnemonics = [
  "humble sense shrug young vehicle assault destroy cook property average silent travel",
  "roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult",
];

const ganacheId = 4447;

type AddressBook = {
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

  let token: Contract | undefined;

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

  const sendGift = async (address: string, token?: Contract): Promise<void> => {
    const ethGift = "100000"; // 1mil eth by default
    const tokenGift = "1000000";
    const ethBalance = await wallet.provider.getBalance(address);
    if (ethBalance.eq(Zero)) {
      console.log(`\nSending ${EtherSymbol} ${ethGift} to ${address}`);
      const tx = await wallet.sendTransaction({
        to: address,
        value: parseEther(ethGift),
      });
      await wallet.provider.waitForTransaction(tx.hash!);
      console.log(`Transaction mined! Hash: ${tx.hash}`);
    } else {
      console.log(`\nAccount ${address} already has ${EtherSymbol} ${formatEther(ethBalance)}`);
    }
    if (token) {
      const tokenBalance = await token.balanceOf(address);
      if (tokenBalance.eq(Zero)) {
        console.log(`Minting ${tokenGift} tokens for ${address}`);
        const tx = await token.mint(address, parseEther(tokenGift));
        await wallet.provider.waitForTransaction(tx.hash);
        console.log(`Transaction mined! Hash: ${tx.hash}`);
      } else {
        console.log(`\nAccount ${address} already has ${formatEther(tokenBalance)} tokens`);
      }
    }
  };

  ////////////////////////////////////////
  // Deploy contracts

  for (const [name, artifact] of Object.entries(artifacts)) {
    await deployContract(name, artifact, []);
  }

  // If this network has no token yet, deploy one
  if (chainId === ganacheId || !getSavedData("Token", "address")) {
    token = await deployContract("Token", tokenArtifacts, []);
  }

  ////////////////////////////////////////
  // On testnet, give relevant accounts a healthy starting balance

  if (chainId === ganacheId) {
    for (const botMnemonic of botMnemonics) {
      await sendGift(Wallet.fromMnemonic(botMnemonic).address, token);
    }
  }

  ////////////////////////////////////////
  // Take a snapshot of this state

  if (chainId === ganacheId) {
    const snapshotId = await (wallet.provider as JsonRpcProvider).send("evm_snapshot", []);
    console.log(`Took an EVM snapshot, id: ${snapshotId}`);
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
    const provider = new JsonRpcProvider(
      argv.ethProvider,
      classicProviders.includes(argv.ethProvider) ? "classic" : undefined,
    );

    await migrate(
      Wallet.fromMnemonic(argv.menmonic).connect(provider),
      argv.addressBook,
    );
  },
};
