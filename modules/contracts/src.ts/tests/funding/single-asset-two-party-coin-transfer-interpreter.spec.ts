import { getRandomAddress } from "@connext/utils";
import { BigNumber, Contract, Wallet, ContractFactory, constants, utils } from "ethers";

import { DolphinCoin, SingleAssetTwoPartyCoinTransferInterpreter } from "../../artifacts";

import { expect, provider } from "../utils";

const { AddressZero, One, Two } = constants;
const { defaultAbiCoder } = utils;

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

const encodeParams = (params: { limit: BigNumber; tokenAddress: string }) => {
  return defaultAbiCoder.encode([`tuple(uint256 limit, address tokenAddress)`], [params]);
};

const encodeOutcome = (state: CoinTransfer[]) => {
  return defaultAbiCoder.encode(
    [
      `
        tuple(
          address to,
          uint256 amount
        )[2]
      `,
    ],
    [state],
  );
};

describe("SingleAssetTwoPartyCoinTransferInterpreter", () => {
  let wallet: Wallet;
  let erc20: Contract;
  let singleAssetTwoPartyCoinTransferInterpreter: Contract;

  const interpretOutcomeAndExecuteEffect = async (
    state: CoinTransfer[],
    params: { limit: BigNumber; tokenAddress: string },
  ) => {
    return singleAssetTwoPartyCoinTransferInterpreter.interpretOutcomeAndExecuteEffect(
      encodeOutcome(state),
      encodeParams(params),
    );
  };

  const getTotalAmountWithdrawn = async (assetId: string) => {
    return singleAssetTwoPartyCoinTransferInterpreter.totalAmountWithdrawn(assetId);
  };

  beforeEach(async () => {
    wallet = (await provider.getWallets())[0];
    erc20 = await new ContractFactory(DolphinCoin.abi, DolphinCoin.bytecode, wallet).deploy();

    singleAssetTwoPartyCoinTransferInterpreter = await new ContractFactory(
      SingleAssetTwoPartyCoinTransferInterpreter.abi,
      SingleAssetTwoPartyCoinTransferInterpreter.bytecode,
      wallet,
    ).deploy();

    // fund interpreter with ETH
    await wallet.sendTransaction({
      to: singleAssetTwoPartyCoinTransferInterpreter.address,
      value: BigNumber.from(100),
    });

    // fund interpreter with ERC20 tokens
    await erc20.transfer(
      singleAssetTwoPartyCoinTransferInterpreter.address,
      erc20.balanceOf(wallet.address),
    );
  });

  it("Can distribute ETH coins correctly", async () => {
    const to1 = getRandomAddress();
    const amount1 = One;

    const to2 = getRandomAddress();
    const amount2 = Two;

    const preAmountWithdrawn = await getTotalAmountWithdrawn(AddressZero);

    await interpretOutcomeAndExecuteEffect(
      [
        { to: to1, amount: amount1 },
        { to: to2, amount: amount2 },
      ],
      {
        limit: amount1.add(amount2),
        tokenAddress: AddressZero,
      },
    );

    expect(await provider.getBalance(to1)).to.eq(amount1);
    expect(await provider.getBalance(to2)).to.eq(amount2);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(
      preAmountWithdrawn.add(amount1).add(amount2),
    );
  });

  it("Can distribute ERC20 coins correctly", async () => {
    const to1 = getRandomAddress();
    const amount1 = One;

    const to2 = getRandomAddress();
    const amount2 = Two;

    const preAmountWithdrawn = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect(
      [
        { to: to1, amount: amount1 },
        { to: to2, amount: amount2 },
      ],
      {
        limit: amount1.add(amount2),
        tokenAddress: erc20.address,
      },
    );

    expect(await erc20.balanceOf(to1)).to.eq(amount1);
    expect(await erc20.balanceOf(to2)).to.eq(amount2);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawn.add(amount1).add(amount2),
    );
  });
});
