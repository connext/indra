import { Address } from "@connext/types";
import * as tokenArtifacts from "@openzeppelin/contracts/build/contracts/ERC20Mintable.json";
import { Contract, Wallet } from "ethers";
import { EtherSymbol, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { formatEther, parseEther } from "ethers/utils";
import { Argv } from "yargs";

import { classicProviders } from "../constants";

export const fund = async (
  sender: Wallet,
  recipient: Address,
  tokenAddress?: Address,
): Promise<void> => {

  const ethGift = "100000"; // 1mil eth by default
  const tokenGift = "1000000";
  const ethBalance = await sender.provider.getBalance(recipient);
  if (ethBalance.eq(Zero)) {
    console.log(`\nSending ${EtherSymbol} ${ethGift} to ${recipient}`);
    const tx = await sender.sendTransaction({
      to: recipient,
      value: parseEther(ethGift),
    });
    await sender.provider.waitForTransaction(tx.hash!);
    console.log(`Transaction mined! Hash: ${tx.hash}`);
  } else {
    console.log(`\nAccount ${recipient} already has ${EtherSymbol} ${formatEther(ethBalance)}`);
  }
  if (tokenAddress) {
    const token = new Contract(tokenAddress, tokenArtifacts.abi as any, sender);
    const tokenBalance = await token.balanceOf(recipient);
    if (tokenBalance.eq(Zero)) {
      console.log(`Minting ${tokenGift} tokens for ${recipient}`);
      const tx = await token.mint(recipient, parseEther(tokenGift));
      await sender.provider.waitForTransaction(tx.hash);
      console.log(`Transaction mined! Hash: ${tx.hash}`);
    } else {
      console.log(`Account ${recipient} already has ${formatEther(tokenBalance)} tokens`);
    }
  }

};

export const fundCommand = {
  command: "fund",
  describe: "Fund an address with a big chunk of ETH (and tokens if token-address is provided)",
  builder: (yargs: Argv) => {
    return yargs
      .option("eth-provider", {
        description: "The URL of a provider for the target Ethereum network",
        type: "string",
      })
      .option("from-mnemonic", {
        description: "The mnemonic for an account which will send funds",
        type: "string",
      })
      .option("to-address", {
        description: "The address to which funds will be send",
        type: "string",
      })
      .option("token-address", {
        description: "The token address to send",
        type: "string",
      })
      .demandOption(["eth-provider", "from-mnemonic", "to-address"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    await fund(
      Wallet.fromMnemonic(argv.fromMnemonic).connect(
        new JsonRpcProvider(
          argv.ethProvider,
          classicProviders.includes(argv.ethProvider) ? "classic" : undefined,
        ),
      ),
      argv.toAddress,
      argv.tokenAddress,
    );
  },
};
