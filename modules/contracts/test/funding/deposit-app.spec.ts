/* global before */
import {
  CoinTransfer,
  singleAssetTwoPartyCoinTransferEncoding,
  DepositAppState,
  DepositAppStateEncoding,
} from "@connext/types";
import { Wallet, ContractFactory, Contract } from "ethers";
import { BigNumber, defaultAbiCoder } from "ethers/utils";

import DepositApp from "../../build/DepositApp.json";
import DelegateProxy from "../../build/DelegateProxy.json";
import DolphinCoin from "../../build/DolphinCoin.json";

import { Zero, AddressZero } from "ethers/constants";

import { expect, provider } from "../utils";
const MAX_INT = new BigNumber(2^256-1);

const decodeTransfers = (encodedTransfers: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedTransfers)[0];

const encodeAppState = (
  state: DepositAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers) return defaultAbiCoder.encode([DepositAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.transfers]);
};

describe.only("DepositApp", () => {

  let wallet: Wallet;
  let depositApp: Contract;
  let proxy: Contract;
  let erc20: Contract;

  const depositorWallet = Wallet.createRandom();
  const counterpartyWallet = Wallet.createRandom();

  before(async () => {
    wallet = (await provider.getWallets())[1];

    depositApp = await new ContractFactory(
      DepositApp.abi,
      DepositApp.bytecode,
      wallet,
    ).deploy();

    erc20 = await new ContractFactory(
      DolphinCoin.abi as any,
      DolphinCoin.bytecode,
      wallet,
    ).deploy();

    proxy = await new ContractFactory(
      DelegateProxy.abi,
      DelegateProxy.bytecode,
      wallet,
    ).deploy();
  });

  const computeOutcome = async (state: DepositAppState): Promise<string> => {
    return await depositApp.functions.computeOutcome(encodeAppState(state));
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
    return assetId === AddressZero
      ? await provider.getBalance(proxy.address)
      : await erc20.functions.balanceOf(proxy.address);
  };

  const getTotalAmountWithdrawn = async (assetId: string): Promise<BigNumber> => {
    return proxy.functions.totalAmountWithdrawn(assetId);
  };

  const deposit = async (assetId: string, amount: BigNumber): Promise<void> => {
    const preDepositValue = await getMultisigBalance(assetId);
    if (assetId === AddressZero) {
      await wallet.sendTransaction({
          value: amount,
          to: proxy.address,
      });
    } else {
      await erc20.functions.transfer([proxy.address, amount]);
    }
    expect(await getMultisigBalance(assetId)).to.be.eq(preDepositValue.add(amount));
  };

  const withdraw = async (assetId: string, amount: BigNumber): Promise<void> => {
    const preWithdrawValue = await getTotalAmountWithdrawn(assetId);
    await proxy.functions.withdraw(assetId, AddressZero, amount);
    expect(await getTotalAmountWithdrawn(assetId)).to.be.eq(preWithdrawValue.add(amount));
  };

  const validateOutcome = async (
    outcome: string, 
    initialState: DepositAppState,
    amount: BigNumber,
  ): Promise<void> => {
    const decoded = decodeTransfers(outcome);
    expect(decoded[0].to).eq(initialState.transfers[0].to);
    expect(decoded[0].amount).eq(amount);
    expect(decoded[1].to).eq(initialState.transfers[1].to);
    expect(decoded[1].amount).eq(Zero);
    expect(
      await getMultisigBalance(initialState.assetId),
    ).to.be.eq(initialState.startingMultisigBalance.add(amount));
    expect(
      await getTotalAmountWithdrawn(initialState.assetId),
    ).to.be.eq(initialState.startingTotalAmountWithdrawn.add(amount));
  };

  it("Correctly calculates deposit amount for Eth", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);

  });

  it("Correctly calculates deposit amount for tokens", async () => {
    const assetId = erc20.address;
    const amount = new BigNumber(10000);
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);
  });

  it("Correctly calculates deposit amount for Eth with eth withdraw", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);
    await withdraw(assetId, amount.div(2));

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);
  });

  it("Correctly calculates deposit amount for token with token withdraw", async () => {
    const assetId = erc20.address;
    const amount = new BigNumber(10000);
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);
    await withdraw(assetId, amount.div(2));

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);
  });

  it("Correctly calculates deposit amount for Eth with token withdraw", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);
    await withdraw(erc20.address, amount);

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);
  });

  it("Correctly calculates deposit amount for Eth with multisig balance calculation underflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    // setup initial balance to almost overflow
    await deposit(assetId, (MAX_INT.sub(amount.div(2))));

    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);
  });

  it("Correctly calculates deposit amount for Eth with deposit amount overflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    // setup some initial balance
    await deposit(assetId, amount);

    const initialState = await createInitialState(assetId);

    // then overflow
    await deposit(assetId, (MAX_INT.sub(amount.div(2))));

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, (MAX_INT.sub(amount.div(2))));
  });

  it("Correctly calculates deposit amount for Eth with withdraw calculation underflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    await deposit(assetId, MAX_INT.sub(amount.sub(1)));
    await withdraw(assetId, (MAX_INT.sub(amount.div(2))));
    
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount.mul(2));
    await withdraw(assetId, amount);

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount.mul(2));
  });

  it("Correctly calculates deposit amount for Eth with withdraw amount overflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    await deposit(assetId, amount);
    await withdraw(assetId, amount);
    
    const initialState = await createInitialState(assetId);

    await deposit(assetId, MAX_INT.sub(amount.sub(1)));
    await withdraw(assetId, (MAX_INT.sub(amount.div(2))));

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, MAX_INT.sub(amount.sub(1)));
  });

  it("Correctly calculates deposit amount for both withdraw/deposit underflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    await deposit(assetId, MAX_INT.sub(amount.div(2)));
    await withdraw(assetId, (MAX_INT.sub(amount.div(2))));
    await deposit(assetId, MAX_INT.sub(amount.sub(1)));
    
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);
    await withdraw(assetId, amount);

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);
  });

  it("Correctly calculates deposit amount for both withdraw/deposit overflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    await deposit(assetId, amount);
    await withdraw(assetId, amount);
    await deposit(assetId, amount);
    
    const initialState = await createInitialState(assetId);

    await deposit(assetId, MAX_INT.sub(amount.div(2)));
    await withdraw(assetId, (MAX_INT.sub(amount.div(2))));

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, MAX_INT.sub(amount.div(2)));
  });

  it("Correctly calculates deposit amount for withdraw underflow and deposit overflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    await deposit(assetId, MAX_INT.sub(amount.div(2)));
    await withdraw(assetId, (MAX_INT.sub(amount.div(2))));
    await deposit(assetId, amount);
    
    const initialState = await createInitialState(assetId);

    await deposit(assetId, MAX_INT.sub(amount.div(2)));
    await withdraw(assetId, amount);

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, MAX_INT.sub(amount.div(2)));
  });

  it("Correctly calculates deposit amount for withdraw overflow and deposit underflow", async () => {
    const assetId = AddressZero;
    const amount = new BigNumber(10000);
    await deposit(assetId, amount);
    await withdraw(assetId, amount);
    await deposit(assetId, MAX_INT.sub(amount.div(2)));
    
    const initialState = await createInitialState(assetId);

    await deposit(assetId, amount);
    await withdraw(assetId, MAX_INT.sub(amount.div(2)));

    const outcome = await computeOutcome(initialState);
    await validateOutcome(outcome, initialState, amount);
  });
});
