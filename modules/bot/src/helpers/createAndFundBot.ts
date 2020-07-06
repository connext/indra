import { Wallet, Contract, BigNumber, providers, utils, constants } from "ethers";
import {
  Address,
  DecString,
  CONVENTION_FOR_ETH_ASSET_ID,
  IConnextClient,
  JsonRpcProvider,
  EventNames,
} from "@connext/types";
import { Token } from "@connext/contracts";
import { abrv, ChannelSigner, toBN } from "@connext/utils";
import { connect } from "@connext/client";
import { env } from "../env";
import { getFileStore } from "@connext/store";

const { parseEther } = utils;
const { AddressZero, Zero } = constants;

// Funds bots onchain and in channel
export const createAndFundClient = async (
  sugarDaddy: Wallet,
  grants: { grantAmt: DecString; assetId: Address }[],
  privateKey: string,
  logLevel: number = 3,
): Promise<IConnextClient> => {
  const bot = new Wallet(privateKey, new JsonRpcProvider(env.ethProviderUrl));
  for (const grant of grants) {
    const value = parseEther(grant.grantAmt);
    let getOnchainBalance: () => Promise<BigNumber>;
    let sendOnchainValue: (gift: BigNumber) => Promise<providers.TransactionResponse>;

    // Create helper functions
    if (grant.assetId !== CONVENTION_FOR_ETH_ASSET_ID) {
      const token = new Contract(grant.assetId, Token.abi, sugarDaddy);
      getOnchainBalance = () => {
        return token.balanceOf(bot.address);
      };
      sendOnchainValue = (gift: BigNumber) => {
        return token.transfer(bot.address, gift);
      };
    } else {
      getOnchainBalance = () => {
        return bot.getBalance();
      };
      sendOnchainValue = (gift: BigNumber) => {
        return sugarDaddy.sendTransaction({
          to: bot.address,
          value: gift,
        });
      };
    }

    // Make sure bot has `grant` amount onchain
    const preDeposit = await getOnchainBalance();

    if (preDeposit.lt(value)) {
      const deposit = value.sub(preDeposit);
      console.log(`Sending ${deposit.toString()} ETH to bot ${abrv(bot.address)}`);
      const tx = await sendOnchainValue(deposit);
      await tx.wait();
      console.log(`Sent: ${tx.hash}`);
    }
  }

  // Create client
  const signer = new ChannelSigner(privateKey, bot.provider);
  const client = await connect({
    ...env,
    signer,
    logLevel,
    store: getFileStore(`.connext-store/${signer.publicIdentifier}`),
  });
  console.log(`Created client ${abrv(client.publicIdentifier)}`);

  // Fund channel
  for (const grant of grants) {
    // User funds
    await new Promise((resolve, reject) => {
      const GAS_AMT = toBN("100_000"); // leave funds for gas
      const amount = parseEther(grant.grantAmt).sub(grant.assetId === AddressZero ? Zero : GAS_AMT);
      client.deposit({ amount, assetId: grant.assetId }).then(resolve);
      client.on(EventNames.DEPOSIT_FAILED_EVENT, reject);
    });
    console.log(`Client ${abrv(client.publicIdentifier)} channel funded with ${grant.assetId}`);

    // Collateral
    await new Promise((resolve, reject) => {
      client.requestCollateral(grant.assetId);
      client.on(EventNames.DEPOSIT_FAILED_EVENT, reject);
      client.on(
        EventNames.DEPOSIT_CONFIRMED_EVENT,
        resolve,
        (data) => data.assetId === grant.assetId,
      );
    });
    console.log(
      `Client ${abrv(client.publicIdentifier)} channel collateralized with ${grant.assetId}`,
    );
  }

  return client;
};
