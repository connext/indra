import { connect } from "@connext/client";
import { ClientOptions, IConnextClient } from "@connext/types";
import { Wallet, Contract } from "ethers";
import { JsonRpcProvider } from "ethers/providers";
import { parseEther } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { MemoryStoreServiceFactory } from "./store";

const mnemonic = process.env.INDRA_ETH_MNEMONIC!;
const provider = new JsonRpcProvider(process.env.INDRA_ETH_RPC_URL!);
const wallet = Wallet.fromMnemonic(mnemonic).connect(provider);

export const createClient = async (
  mnemonic: string = Wallet.createRandom().mnemonic,
): Promise<IConnextClient> => {
  const storeServiceFactory = new MemoryStoreServiceFactory();

  const clientStore = storeServiceFactory.createStoreService();
  const clientOpts: ClientOptions = {
    ethProviderUrl: process.env.INDRA_ETH_RPC_URL!,
    logLevel: parseInt(process.env.INDRA_CLIENT_LOG_LEVEL!, 10),
    mnemonic,
    nodeUrl: process.env.INDRA_NODE_URL,
    store: clientStore,
  };
  const client = await connect(clientOpts);

  // TODO: add client endpoint to get node config, so we can easily have its xpub etc

  await client.isAvailable();

  const ethTx = await wallet.sendTransaction({ to: client.signerAddress, value: parseEther("0.1") })
  const token = new Contract(client.config.contractAddresses.Token, tokenAbi, wallet);
  const tokenTx = await token.functions.transfer(client.signerAddress, parseEther("10"));

  await Promise.all([ethTx.wait(), tokenTx.wait()]);

  expect(client.freeBalanceAddress).toBeTruthy();
  expect(client.publicIdentifier).toBeTruthy();

  return client;
};
