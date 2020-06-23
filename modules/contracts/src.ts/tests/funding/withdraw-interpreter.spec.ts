import { getRandomAddress } from "@connext/utils";
import { BigNumber, Contract, Wallet, ContractFactory, constants, utils } from "ethers";

import { DolphinCoin, WithdrawInterpreter } from "../../artifacts";

import { expect, provider } from "../utils";

const { AddressZero, One } = constants;
const { defaultAbiCoder } = utils;

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

const encodeParams = (params: { limit: BigNumber; tokenAddress: string }) => {
  return defaultAbiCoder.encode([`tuple(uint256 limit, address tokenAddress)`], [params]);
};

const encodeOutcome = (state: CoinTransfer) => {
  return defaultAbiCoder.encode(
    [
      `
        tuple(
          address to,
          uint256 amount
        )
      `,
    ],
    [state],
  );
};

describe("WithdrawInterpreter", () => {
  let wallet: Wallet;
  let erc20: Contract;
  let withdrawInterpreter: Contract;

  const interpretOutcomeAndExecuteEffect = async (
    state: CoinTransfer,
    params: { limit: BigNumber; tokenAddress: string },
  ) => {
    return withdrawInterpreter.interpretOutcomeAndExecuteEffect(
      encodeOutcome(state),
      encodeParams(params),
    );
  };

  const getTotalAmountWithdrawn = async (assetId: string) => {
    return withdrawInterpreter.totalAmountWithdrawn(assetId);
  };

  beforeEach(async () => {
    wallet = (await provider.getWallets())[0];
    erc20 = await new ContractFactory(DolphinCoin.abi, DolphinCoin.bytecode, wallet).deploy();

    withdrawInterpreter = await new ContractFactory(
      WithdrawInterpreter.abi,
      WithdrawInterpreter.bytecode,
      wallet,
    ).deploy();

    // fund interpreter with ETH
    await wallet.sendTransaction({
      to: withdrawInterpreter.address,
      value: BigNumber.from(100),
    });

    // fund interpreter with ERC20 tokens
    await erc20.transfer(
      withdrawInterpreter.address,
      erc20.balanceOf(wallet.address),
    );
  });

  it("Can withdraw ETH coins correctly", async () => {
    const to = getRandomAddress();
    const amount = One;

    const preAmountWithdrawn = await getTotalAmountWithdrawn(AddressZero);

    await interpretOutcomeAndExecuteEffect(
      {
        to,
        amount,
      },
      {
        limit: amount,
        tokenAddress: AddressZero,
      },
    );

    expect(await provider.getBalance(to)).to.eq(amount);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(
      preAmountWithdrawn.add(amount),
    );
  });

  it("Can withdraw ERC20 coins correctly", async () => {
    const to = getRandomAddress();
    const amount = One;

    const preAmountWithdrawn = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect(
      {
        to,
        amount,
      },
      {
        limit: amount,
        tokenAddress: erc20.address,
      },
    );

    expect(await erc20.balanceOf(to)).to.eq(amount);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawn.add(amount),
    );
  });
});
