import { Options } from "yargs";

export const botMnemonics = [
  "humble sense shrug young vehicle assault destroy cook property average silent travel",
  "roof traffic soul urge tenant credit protect conduct enable animal cinnamon adult",
];

export const classicProviders = ["https://www.ethercluster.com/etc"];

export const defaults = {
  mnemonic: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
  providerUrl: "http://localhost:8545",
  addressBookPath: "./address-book.json",
};

export const ganacheId = 4447;

export const cliOpts = {
  addressBook: {
    alias: "address-book",
    description: "The path to your address book file",
    type: "string",
    default: defaults.addressBookPath,
  },
  amount: {
    alias: "amount",
    description: "The amount of tokens or ETH to send",
    type: "string",
    default: "1",
  },
  ethProvider: {
    alias: "eth-provider",
    description: "The URL of an Ethereum provider",
    type: "string",
    default: defaults.providerUrl,
  },
  fromMnemonic: {
    alias: "from-mnemonic", 
    description: "The mnemonic for an account which will send funds",
    type: "string",
    default: defaults.mnemonic,
  },
  mnemonic: {
    alias: "mnemonic",
    description: "The mnemonic for an account which will pay for gas",
    type: "string",
    default: defaults.mnemonic,
  },
  toAddress: {
    alias: "to-address",
    description: "The address to which funds will be sent",
    type: "string",
  },
  tokenAddress: {
    alias: "token-address",
    description: "The address of the token",
    type: "string",
  },
} as { [key: string]: Options };
