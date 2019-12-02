import { CF_PATH } from "@connext/types";
import dotenvExtended from "dotenv-extended";
import { Wallet } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { parseEther } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";

import { deployTestArtifactsToChain } from "./contracts";
import {
  A_EXTENDED_PRIVATE_KEY,
  B_EXTENDED_PRIVATE_KEY,
  C_EXTENDED_PRIVATE_KEY,
} from "./test-constants.jest";

dotenvExtended.load();
const env = {
  ETHPROVIDER_URL: process.env.ETHPROVIDER_URL || "http://localhost:8545",
  SUGAR_DADDY:
    process.env.SUGAR_DADDY ||
    "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat",
};

const fundAddress = async (to: string, ethProvider: JsonRpcProvider): Promise<void> => {
  const sugarDaddy = Wallet.fromMnemonic(env.SUGAR_DADDY).connect(ethProvider);
  const tx = await sugarDaddy.sendTransaction({ to, value: parseEther("10") });
  if (!tx.hash) throw new Error(`Couldn't fund account ${to}`);
  await ethProvider.waitForTransaction(tx.hash);
};

export default async function globalSetup(): Promise<void> {
  console.log(`==================== globalSetup activated! ${env.ETHPROVIDER_URL}`);
  const ethProvider = new JsonRpcProvider(env.ETHPROVIDER_URL);
  const network = await ethProvider.getNetwork();
  console.log(`==================== Connected to ethprovider for ${JSON.stringify(network)}`);
  await Promise.all(
    [A_EXTENDED_PRIVATE_KEY, B_EXTENDED_PRIVATE_KEY, C_EXTENDED_PRIVATE_KEY].map(
      (xprv: string): Promise<void> =>
        fundAddress(fromExtendedKey(xprv).derivePath(`${CF_PATH}/0`).address, ethProvider),
    ),
  );
  const fundedAccount = Wallet.createRandom().connect(ethProvider);
  await fundAddress(fundedAccount.address, ethProvider);
  global["fundedPrivateKey"] = fundedAccount.privateKey;
  global["ganacheUrl"] = env.ETHPROVIDER_URL;
  global["networkContext"] = await deployTestArtifactsToChain(fundedAccount);
}
