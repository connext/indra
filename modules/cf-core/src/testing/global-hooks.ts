import { getChainId } from "@connext/utils";
import { Wallet, providers, utils } from "ethers";

import { deployTestArtifactsToChain } from "./contracts";
import { A_PRIVATE_KEY, B_PRIVATE_KEY, C_PRIVATE_KEY } from "./test-constants.jest";

const { parseEther } = utils;

const env = {
  ethproviderUrl: process.env.ETHPROVIDER_URL || "http://localhost:8545",
  logLevel: parseInt(process.env.LOG_LEVEL || "0", 10),
  sugarDaddy:
    process.env.SUGAR_DADDY ||
    "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
};

const fundAddress = async (to: string, ethProvider: providers.JsonRpcProvider): Promise<void> => {
  const sugarDaddy = Wallet.fromMnemonic(env.sugarDaddy).connect(ethProvider);
  const tx = await sugarDaddy.sendTransaction({ to, value: parseEther("1000") });
  if (!tx.hash) throw new Error(`Couldn't fund account ${to}`);
  await ethProvider.waitForTransaction(tx.hash);
};

async function globalSetup(): Promise<void> {
  const chainId = await getChainId(env.ethproviderUrl);
  const ethProvider = new providers.JsonRpcProvider(env.ethproviderUrl, chainId);
  const fundedAccount = Wallet.createRandom().connect(ethProvider);
  const addresses = [A_PRIVATE_KEY, B_PRIVATE_KEY, C_PRIVATE_KEY].map(
    (prv: string): string => new Wallet(prv).address,
  );
  await fundAddress(addresses[0], ethProvider);
  await fundAddress(addresses[1], ethProvider);
  await fundAddress(addresses[2], ethProvider);
  await fundAddress(fundedAccount.address, ethProvider);
  global["wallet"] = fundedAccount;
  global["networks"] = {
    [chainId.toString()]: {
      contractAddresses: await deployTestArtifactsToChain(fundedAccount),
      provider: ethProvider,
    },
  };
  console.log(`Done setting up global stuff`);
}

export const mochaHooks = {
  async beforeAll() {
    await globalSetup();
  },
};
