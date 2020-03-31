import { waffle as buidler } from "@nomiclabs/buidler";

import {
  CoinTransfer,
  singleAssetTwoPartyCoinTransferEncoding,
  DepositAppState,
  DepositAppStateEncoding,
} from "@connext/types";
import chai from "chai";
import * as waffle from "ethereum-waffle";
import { Contract, Wallet } from "ethers";
import { BigNumber, defaultAbiCoder } from "ethers/utils";

import DepositApp from "../../build/DepositApp.json";
import DelegateProxy from "../../build/DelegateProxy.json";
import DolphinCoin from "../../build/DolphinCoin.json";

import { Zero, AddressZero } from "ethers/constants";

const { expect } = chai;

const decodeTransfers = (encodedTransfers: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedTransfers)[0];

const encodeAppState = (
  state: DepositAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([DepositAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.transfers]);
};

describe("DepositApp", async () => {
  let provider = buidler.provider;
  const wallet = (await provider.getWallets())[0];
  const withdrawApp: Contract = await waffle.deployContract(wallet, DepositApp);
  const proxy: Contract = await waffle.deployContract(wallet, DelegateProxy);
  const erc20: Contract = await waffle.deployContract(wallet, DolphinCoin);

  let depositorWallet = Wallet.createRandom();
  let counterpartyWallet = Wallet.createRandom();

  const computeOutcome = async (state: DepositAppState): Promise<string> => {
    return await withdrawApp.functions.computeOutcome(encodeAppState(state));
  };

  const createInitialState = async (assetId: string): Promise<DepositAppState> => {
    return {
      transfers: [
        {
          amount: Zero,
          to: depositorWallet.address,
        },
        {
          amount: Zero,
          to: counterpartyWallet.address,
        },
      ],
      multisigAddress: proxy.address,
      assetId,
      startingTotalAmountWithdrawn: await getTotalAmountWithdrawn(assetId), 
      startingMultisigBalance: await getMultisigBalance(assetId),
    };
  };

  const getMultisigBalance = async (assetId: string): Promise<BigNumber> => {
    return assetId == AddressZero? await provider.getBalance(proxy.address): await erc20.functions.balanceOf(proxy.address);
  }

  const getTotalAmountWithdrawn = async (assetId: string): Promise<BigNumber> => {
    return proxy.functions.totalAmountWithdrawn(assetId)
  }

  const deposit = async (assetId: string, amount: BigNumber): Promise<void> => {
    const preDepositValue = await getMultisigBalance(assetId);
    if(assetId == AddressZero) {
        await wallet.sendTransaction({
            value: amount,
            to: proxy.address
        })
    } else {
        await erc20.functions.transfer([proxy.address, amount]);
    }
    expect(await getMultisigBalance(assetId)).to.be.eq(preDepositValue.add(amount))
  }

  beforeEach(async () => {});

  it("Correctly calculates deposit amount for Eth", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    const initialState = await createInitialState(assetId);
    const startingTotalAmountWithdrawn = initialState.startingTotalAmountWithdrawn;
    const startingMultisigBalance = initialState.startingMultisigBalance;

    await deposit(assetId, amount);

    const ret = await computeOutcome(initialState);
    const decoded = decodeTransfers(ret);

    expect(decoded[0].to).eq(initialState.transfers[0].to);
    expect(decoded[0].amount).eq(amount);
    expect(decoded[1].to).eq(initialState.transfers[1].to);
    expect(decoded[1].amount).eq(Zero);
    expect(await getMultisigBalance(assetId)).to.be.eq(startingMultisigBalance.add(amount))
    expect(await getTotalAmountWithdrawn(assetId)).to.be.eq(startingTotalAmountWithdrawn.add(amount))
  });
});
