import { EXPECTED_CONTRACT_NAMES_IN_NETWORK_CONTEXT as coreContracts } from "@connext/types";
import { Contract, ContractFactory, Wallet } from "ethers";
import { EtherSymbol, Zero } from "ethers/constants";
import { formatEther, keccak256, parseEther } from "ethers/utils";
import fs from "fs";

const tokenArtifacts = require("openzeppelin-solidity/build/contracts/ERC20Mintable.json");

const appContracts = ["SimpleLinkedTransferApp", "SimpleTransferApp", "SimpleTwoPartySwapApp"];

console.log(`Core contracts: ${JSON.stringify(coreContracts)}`);

const artifacts = {};
for (const contract of coreContracts) {
  try {
    artifacts[contract] = require(`@connext/cf-adjudicator-contracts/build/${contract}.json`);
    console.log(`Imported adjudicator contract: ${contract}`);
  } catch (e) {
    artifacts[contract] = require(`@connext/cf-funding-protocol-contracts/build/${contract}.json`);
    console.log(`Imported funding contract: ${contract}`);
  }
}
for (const contract of appContracts) {
  artifacts[contract] = require(`../../../contracts/build/${contract}.json`);
}

////////////////////////////////////////
// Environment Setup

const shouldUpdateProxyFactory = false;
const botMnemonics = [
  "humble sense shrug young vehicle assault destroy cook property average silent travel",
  "roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult",
];
const cfPath = "m/44'/60'/0'/25446/0";
const ganacheId = 4447;

const project = "indra";
const cwd = process.cwd();
const HOME =
  cwd.indexOf(project) !== -1
    ? `${cwd.substring(0, cwd.indexOf(project) + project.length)}`
    : `/root`;
const addressBookPath = `${HOME}/address-book.json`;
const addressBook = JSON.parse(fs.readFileSync(addressBookPath, "utf8") || "{}");

// Global scope vars

////////////////////////////////////////
// Helper Functions

const getSavedData = (contractName, property) => {
  try {
    return addressBook[ganacheId][contractName][property];
  } catch (e) {
    return undefined;
  }
};

// Write addressBook to disk
const saveAddressBook = addressBook => {
  try {
    fs.unlinkSync(addressBookPath);
    fs.writeFileSync(addressBookPath, JSON.stringify(addressBook, null, 2));
  } catch (e) {
    console.log(`Error saving artifacts: ${e}`);
  }
};

// Simple sanity checks to make sure contracts from our address book have been deployed
const contractIsDeployed = async (address, wallet) => {
  if (!address || address === "") {
    console.log(`This contract is not in our address book.`);
    return false;
  }
  const bytecode = await wallet.provider.getCode(address);
  console.log(`Got bytecode hash for ${address}: ${keccak256(bytecode)}`);
  if (bytecode === "0x00" || bytecode === "0x") {
    console.log(`No bytecode exists at the address in our address book`);
    return false;
  }
  return true;
};

const deployContract = async (name, artifacts, args, wallet) => {
  console.log(`\nChecking for valid ${name} contract...`);
  const savedAddress = getSavedData(name, "address");
  if (await contractIsDeployed(savedAddress, wallet)) {
    console.log(`${name} is up to date, no action required\nAddress: ${savedAddress}`);
    return new Contract(savedAddress, artifacts.abi, wallet);
  }
  const factory = ContractFactory.fromSolidity(artifacts);
  const contract = await factory.connect(wallet).deploy(...args.map(a => a.value));
  const txHash = contract.deployTransaction.hash;
  console.log(`Sent transaction to deploy ${name}, txHash: ${txHash}`);
  await wallet.provider.waitForTransaction(txHash);
  const address = contract.address;
  console.log(`${name} has been deployed to address: ${address}`);
  const bytecode = keccak256(await wallet.provider.getCode(address));
  // Update address-book w new address + the args we deployed with
  const saveArgs = {};
  args.forEach(a => (saveArgs[a.name] = a.value));
  if (!addressBook[ganacheId]) addressBook[ganacheId] = {};
  if (!addressBook[ganacheId][name]) addressBook[ganacheId][name] = {};
  addressBook[ganacheId][name] = { address, bytecode, txHash, ...saveArgs };
  saveAddressBook(addressBook);
  return contract;
};

const sendGift = async (address, token, wallet) => {
  const ethGift = "3";
  const tokenGift = "1000000";
  const ethBalance = await wallet.provider.getBalance(address);
  if (ethBalance.eq(Zero)) {
    console.log(`\nSending ${EtherSymbol} ${ethGift} to ${address}`);
    const tx = await wallet.sendTransaction({
      to: address,
      value: parseEther(ethGift),
    });
    await wallet.provider.waitForTransaction(tx.hash);
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
// Begin executing main migration script in async wrapper function
// First, setup signer & connect to eth provider
export const deployContracts = async (wallet: Wallet, mnemonic) => {
  const chainId = (await wallet.provider.getNetwork()).chainId; // saved to global scope
  if (chainId !== ganacheId) {
    throw new Error(`Deployment will only happen on ganache for testing`);
  }
  const balance = formatEther(await wallet.getBalance());
  const nonce = await wallet.getTransactionCount();

  // Sanity check: Is our eth provider serving us the correct network?
  console.log(`\nPreparing to migrate contracts to network (${chainId})`);
  console.log(`Deployer Wallet: address=${wallet.address} nonce=${nonce} balance=${balance}`);

  ////////////////////////////////////////
  // Deploy contracts

  for (const contract of coreContracts) {
    await deployContract(contract, artifacts[contract], [], wallet);
  }

  for (const contract of appContracts) {
    await deployContract(contract, artifacts[contract], [], wallet);
  }

  // If on testnet, deploy a token contract too
  const token = await deployContract("Token", tokenArtifacts, [], wallet);

  ////////////////////////////////////////
  // On testnet, give relevant accounts a healthy starting balance

  await sendGift(wallet.address, token, wallet);
  await sendGift(Wallet.fromMnemonic(mnemonic, cfPath).address, token, wallet);
  for (const botMnemonic of botMnemonics) {
    await sendGift(Wallet.fromMnemonic(botMnemonic).address, token, wallet);
    await sendGift(Wallet.fromMnemonic(botMnemonic, cfPath).address, token, wallet);
  }

  ////////////////////////////////////////
  // Print summary

  console.log(`\nAll done!`);
  const spent = formatEther(parseEther(balance).sub(await wallet.getBalance()));
  const nTx = (await wallet.getTransactionCount()) - nonce;
  console.log(`Sent ${nTx} transaction${nTx === 1 ? "" : "s"} & spent ${EtherSymbol} ${spent}`);
};
