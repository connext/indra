import { getRandomAddress } from "@connext/utils";
import { BigNumber, Contract, Wallet, ContractFactory, constants, utils } from "ethers";

import { DolphinCoin, MultiAssetMultiPartyCoinTransferInterpreter } from "../../artifacts";

import { expect, provider } from "../utils";

const { AddressZero, One, Two } = constants;
const { defaultAbiCoder } = utils;

const Three = BigNumber.from("3");
const Four = BigNumber.from("4");

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

const encodeParams = (params: { limit: BigNumber[]; tokenAddresses: string[] }) => {
  return defaultAbiCoder.encode([`tuple(uint256[] limit, address[] tokenAddresses)`], [params]);
};

const encodeOutcome = (state: CoinTransfer[][]) => {
  return defaultAbiCoder.encode(
    [
      `
        tuple(
          address to,
          uint256 amount
        )[][]
      `,
    ],
    [state],
  );
};

describe("MultiAssetMultiPartyCoinTransferInterpreter", () => {
  let wallet: Wallet;
  let erc20: Contract;
  let multiAssetMultiPartyCoinTransferInterpreter: Contract;

  const interpretOutcomeAndExecuteEffect = async (
    state: CoinTransfer[][],
    params: { limit: BigNumber[]; tokenAddresses: string[] },
  ) => {
    return multiAssetMultiPartyCoinTransferInterpreter.interpretOutcomeAndExecuteEffect(
      encodeOutcome(state),
      encodeParams(params),
    );
  };

  const getTotalAmountWithdrawn = async (assetId: string) => {
    return multiAssetMultiPartyCoinTransferInterpreter.totalAmountWithdrawn(assetId);
  };

  beforeEach(async () => {
    wallet = (await provider.getWallets())[0];
    erc20 = await new ContractFactory(DolphinCoin.abi, DolphinCoin.bytecode, wallet).deploy();

    multiAssetMultiPartyCoinTransferInterpreter = await new ContractFactory(
      MultiAssetMultiPartyCoinTransferInterpreter.abi,
      MultiAssetMultiPartyCoinTransferInterpreter.bytecode,
      wallet,
    ).deploy();

    // fund interpreter with ETH
    await wallet.sendTransaction({
      to: multiAssetMultiPartyCoinTransferInterpreter.address,
      value: BigNumber.from(100),
    });

    // fund interpreter with ERC20 tokens
    await erc20.transfer(
      multiAssetMultiPartyCoinTransferInterpreter.address,
      erc20.balanceOf(wallet.address),
    );
  });

  it("Can distribute ETH coins only correctly to one person", async () => {
    const to = getRandomAddress();
    const amount = One;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(AddressZero);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }]], {
      limit: [amount],
      tokenAddresses: [AddressZero],
    });

    expect(await provider.getBalance(to)).to.eq(amount);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawn.add(amount));
  });

  it("Can distribute ETH coins only correctly to two people", async () => {
    const to1 = getRandomAddress();
    const amount1 = One;

    const to2 = getRandomAddress();
    const amount2 = Two;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(AddressZero);

    await interpretOutcomeAndExecuteEffect(
      [
        [
          { to: to1, amount: amount1 },
          { to: to2, amount: amount2 },
        ],
      ],
      {
        limit: [amount1.add(amount2)],
        tokenAddresses: [AddressZero],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(amount1);
    expect(await provider.getBalance(to2)).to.eq(amount2);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawn.add(amount1).add(amount2));
  });

  it("Can distribute ERC20 coins only correctly to one person", async () => {
    const to = getRandomAddress();
    const amount = One;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }]], {
      limit: [amount],
      tokenAddresses: [erc20.address],
    });

    expect(await erc20.balanceOf(to)).to.eq(amount);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(preAmountWithdrawn.add(amount));
  });

  it("Can distribute ERC20 coins only correctly to two people", async () => {
    const to1 = getRandomAddress();
    const amount1 = One;

    const to2 = getRandomAddress();
    const amount2 = Two;

    const preAmountWithdrawn = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect(
      [
        [
          { to: to1, amount: amount1 },
          { to: to2, amount: amount2 },
        ],
      ],
      {
        limit: [amount1.add(amount2)],
        tokenAddresses: [erc20.address],
      },
    );

    expect(await erc20.balanceOf(to1)).to.eq(amount1);
    expect(await erc20.balanceOf(to2)).to.eq(amount2);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawn.add(amount1).add(amount2),
    );
  });

  it("Can distribute both ETH and ERC20 coins to one person", async () => {
    const to = getRandomAddress();
    const amountEth = One;
    const amountToken = Two;
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);
    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect([[{ to, amount: amountEth }], [{ to, amount: amountToken }]], {
      limit: [amountEth, amountToken],
      tokenAddresses: [AddressZero, erc20.address],
    });

    expect(await provider.getBalance(to)).to.eq(amountEth);
    expect(await erc20.balanceOf(to)).to.eq(amountToken);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawnEth.add(amountEth));
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(preAmountWithdrawnToken.add(amountToken));
  });

  it("Can distribute a split of ETH and ERC20 coins to two people", async () => {
    const to1 = getRandomAddress();
    const amount1Eth = One;

    const to2 = getRandomAddress();
    const amount2Token = Two;

    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);
    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect(
      [[{ to: to1, amount: amount1Eth }], [{ to: to2, amount: amount2Token }]],
      {
        limit: [amount1Eth, amount2Token],
        tokenAddresses: [AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(amount1Eth);
    expect(await erc20.balanceOf(to2)).to.eq(amount2Token);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawnEth.add(amount1Eth));
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(preAmountWithdrawnToken.add(amount2Token));
  });

  it("Can distribute a mix of ETH and ERC20 coins to two people", async () => {
    const to1 = getRandomAddress();
    const amount1Eth = One;
    const amount1Token = Two;

    const to2 = getRandomAddress();
    const amount2Eth = Three;
    const amount2Token = Four;

    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);
    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect(
      [
        [
          { to: to1, amount: amount1Eth },
          { to: to2, amount: amount2Eth },
        ],
        [
          { to: to1, amount: amount1Token },
          { to: to2, amount: amount2Token },
        ],
      ],
      {
        limit: [amount1Eth.add(amount2Eth), amount1Token.add(amount2Token)],
        tokenAddresses: [AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(amount1Eth);
    expect(await erc20.balanceOf(to1)).to.eq(amount1Token);

    expect(await provider.getBalance(to2)).to.eq(amount2Eth);
    expect(await erc20.balanceOf(to2)).to.eq(amount2Token);

    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(
      preAmountWithdrawnEth.add(amount1Eth).add(amount2Eth),
    );
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawnToken.add(amount1Token).add(amount2Token),
    );
  });

  it("Can distribute a mix of ETH and ERC20 coins to an unorderded list of people", async () => {
    const to1 = getRandomAddress();
    const amount1Eth = One;
    const amount1Token = Two;

    const to2 = getRandomAddress();
    const amount2Eth = Three;
    const amount2Token = Four;

    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);
    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect(
      [
        [
          { to: to2, amount: amount2Eth },
          { to: to1, amount: amount1Eth },
        ],
        [
          { to: to1, amount: amount1Token },
          { to: to2, amount: amount2Token },
        ],
      ],
      {
        limit: [amount1Eth.add(amount2Eth), amount1Token.add(amount2Token)],
        tokenAddresses: [AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(amount1Eth);
    expect(await erc20.balanceOf(to1)).to.eq(amount1Token);

    expect(await provider.getBalance(to2)).to.eq(amount2Eth);
    expect(await erc20.balanceOf(to2)).to.eq(amount2Token);

    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(
      preAmountWithdrawnEth.add(amount1Eth).add(amount2Eth),
    );
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawnToken.add(amount1Token).add(amount2Token),
    );
  });
});
