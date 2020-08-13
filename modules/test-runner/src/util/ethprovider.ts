import { ERC20 } from "@connext/contracts";
import { getAddressFromAssetId } from "@connext/utils";
import { BigNumber, BigNumberish, Contract, Wallet, providers, constants, utils } from "ethers";

import { env } from "./env";

const { AddressZero } = constants;
const { parseEther } = utils;

export const ethProviderUrl = env.chainProviders[env.defaultChain];
export const ethProvider = new providers.JsonRpcProvider(ethProviderUrl);

export const ethProviderUrlForChain = (chainId: number) => env.chainProviders[chainId];
export const ethProviderForChain = (chainId: number) =>
  new providers.JsonRpcProvider(ethProviderUrlForChain(chainId));
export const sugarDaddy = Wallet.fromMnemonic(env.mnemonic).connect(ethProvider);
export const ethWallet = Wallet.createRandom().connect(ethProvider);

export const fundEthWallet = async (chainId: number = env.defaultChain) => {
  const FUND_AMT = parseEther("10000");
  const tokenContract = new Contract(
    env.contractAddresses[chainId].Token.address,
    ERC20.abi,
    sugarDaddy,
  );
  const ethFunding = await sugarDaddy.sendTransaction({
    to: ethWallet.address,
    value: FUND_AMT,
  });
  await ethFunding.wait();
  const tx = await tokenContract.transfer(ethWallet.address, FUND_AMT);
  await tx.wait();
  return;
};

export const sendOnchainValue = async (
  to: string,
  value: BigNumberish,
  assetId: string = AddressZero,
): Promise<void> => {
  const nonceErr = "the tx doesn't have the correct nonce";
  const retries = 3;
  for (let i = 0; i < retries; i++) {
    const nonce = await ethWallet.getTransactionCount();
    try {
      if (assetId === AddressZero) {
        const tx = await ethWallet.sendTransaction({
          to,
          value,
          nonce,
        });
        await tx.wait();
        return;
      } else {
        const tokenContract = new Contract(getAddressFromAssetId(assetId), ERC20.abi, ethWallet);
        const tx = await tokenContract.transfer(to, value, { nonce });
        await tx.wait();
        return;
      }
    } catch (e) {
      if (e.message.includes(nonceErr)) {
        continue;
      }
      throw e;
    }
  }
};

export const getOnchainBalance = async (
  address: string,
  assetId: string = AddressZero,
): Promise<BigNumber> => {
  let result: BigNumber;
  if (assetId === AddressZero) {
    try {
      result = await ethProvider.getBalance(address);
    } catch (e) {
      throw new Error(`Error getting Eth balance for ${address}: ${e.toString()}`);
    }
  } else {
    try {
      const tokenContract = new Contract(getAddressFromAssetId(assetId), ERC20.abi, ethProvider);
      result = await tokenContract.balanceOf(address);
    } catch (e) {
      throw new Error(`Error getting token balance for ${address}: ${e.toString()}`);
    }
  }
  return result;
};
