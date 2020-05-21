import dotenvExtended from "dotenv-extended";
import { Wallet, providers, utils } from "ethers";

import { deployTestArtifactsToChain } from "./contracts";
import { A_PRIVATE_KEY, B_PRIVATE_KEY, C_PRIVATE_KEY } from "./test-constants.jest";

const { parseEther } = utils;

dotenvExtended.load();
const env = {
  ETHPROVIDER_URL: process.env.ETHPROVIDER_URL || "http://localhost:8545",
  SUGAR_DADDY:
    process.env.SUGAR_DADDY ||
    "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
};

const fundAddress = async (to: string, ethProvider: providers.JsonRpcProvider): Promise<void> => {
  const sugarDaddy = Wallet.fromMnemonic(env.SUGAR_DADDY).connect(ethProvider);
  const tx = await sugarDaddy.sendTransaction({ to, value: parseEther("1000") });
  if (!tx.hash) throw new Error(`Couldn't fund account ${to}`);
  await ethProvider.waitForTransaction(tx.hash);
};

export default async function globalSetup(): Promise<void> {
  const ethProvider = new providers.JsonRpcProvider(env.ETHPROVIDER_URL) as any;
  const fundedAccount = Wallet.createRandom().connect(ethProvider);
  const addresses = [A_PRIVATE_KEY, B_PRIVATE_KEY, C_PRIVATE_KEY].map(
    (prv: string): string => new Wallet(prv).address,
  );
  await fundAddress(addresses[0], ethProvider);
  await fundAddress(addresses[1], ethProvider);
  await fundAddress(addresses[2], ethProvider);
  await fundAddress(fundedAccount.address, ethProvider);
  global["wallet"] = fundedAccount;
  global["contracts"] = await deployTestArtifactsToChain(fundedAccount);
  if (!global["contracts"]) {
    throw new Error(`Oops didn't set: ${JSON.stringify(global["contracts"])}`);
  }
}
