import { getRandomAddress } from "@connext/utils";
import { Contract, Wallet, ContractFactory, BigNumber, constants, utils } from "ethers";

import DolphinCoin from "../../build/DolphinCoin.json";
import MultiAssetMultiPartyCoinTransferInterpreter from "../../build/MultiAssetMultiPartyCoinTransferInterpreter.json";

import { expect, provider } from "../utils";

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

function encodeParams(params: { limit: BigNumber[]; tokenAddresses: string[] }) {
  return utils.defaultAbiCoder.encode(
    [`tuple(uint256[] limit, address[] tokenAddresses)`],
    [params],
  );
}

function encodeOutcome(state: CoinTransfer[][]) {
  return utils.defaultAbiCoder.encode(
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
}

describe("MultiAssetMultiPartyCoinTransferInterpreter", () => {
  let wallet: Wallet;
  let erc20: Contract;
  let multiAssetMultiPartyCoinTransferInterpreter: Contract;

  async function interpretOutcomeAndExecuteEffect(
    state: CoinTransfer[][],
    params: { limit: BigNumber[]; tokenAddresses: string[] },
  ) {
    return multiAssetMultiPartyCoinTransferInterpreter.interpretOutcomeAndExecuteEffect(
      encodeOutcome(state),
      encodeParams(params),
    );
  }

  async function getTotalAmountWithdrawn(assetId: string) {
    return multiAssetMultiPartyCoinTransferInterpreter.totalAmountWithdrawn(assetId);
  }

  beforeEach(async () => {
    wallet = new Wallet((await provider.getWallets())[0].privateKey);
    erc20 = await new ContractFactory(DolphinCoin.abi, DolphinCoin.bytecode, wallet).deploy();

    multiAssetMultiPartyCoinTransferInterpreter = await new ContractFactory(
      MultiAssetMultiPartyCoinTransferInterpreter.abi,
      MultiAssetMultiPartyCoinTransferInterpreter.bytecode,
      wallet,
    ).deploy();

    // fund interpreter with ERC20 tokenAddresses
    await erc20.transfer(
      multiAssetMultiPartyCoinTransferInterpreter.address,
      erc20.balanceOf(wallet.address),
    );

    // fund interpreter with ETH
    await wallet.sendTransaction({
      to: multiAssetMultiPartyCoinTransferInterpreter.address,
      value: BigNumber.from(100),
    });
  });

  it("Can distribute ETH coins only correctly to one person", async () => {
    const to = getRandomAddress();
    const amount = constants.One;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(constants.AddressZero);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }]], {
      limit: [amount],
      tokenAddresses: [constants.AddressZero],
    });

    expect(await provider.getBalance(to)).to.eq(constants.One);
    expect(await getTotalAmountWithdrawn(constants.AddressZero)).to.eq(
      preAmountWithdrawn.add(constants.One),
    );
  });

  it("Can distribute ETH coins only correctly two people", async () => {
    const to1 = getRandomAddress();
    const amount1 = constants.One;

    const to2 = getRandomAddress();
    const amount2 = constants.One;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(constants.AddressZero);

    await interpretOutcomeAndExecuteEffect(
      [
        [
          { to: to1, amount: amount1 },
          { to: to2, amount: amount2 },
        ],
      ],
      {
        limit: [amount1.add(amount2)],
        tokenAddresses: [constants.AddressZero],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(constants.One);
    expect(await provider.getBalance(to2)).to.eq(constants.One);
    expect(await getTotalAmountWithdrawn(constants.AddressZero)).to.eq(
      preAmountWithdrawn.add(constants.One).add(constants.One),
    );
  });

  it("Can distribute ERC20 coins correctly for one person", async () => {
    const to = getRandomAddress();
    const amount = constants.One;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }]], {
      limit: [amount],
      tokenAddresses: [erc20.address],
    });

    expect(await erc20.balanceOf(to)).to.eq(constants.One);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawn.add(constants.One),
    );
  });

  it("Can distribute ERC20 coins only correctly two people", async () => {
    const to1 = getRandomAddress();
    const amount1 = constants.One;

    const to2 = getRandomAddress();
    const amount2 = constants.One;

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

    expect(await erc20.balanceOf(to1)).to.eq(constants.One);
    expect(await erc20.balanceOf(to2)).to.eq(constants.One);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawn.add(constants.One).add(constants.One),
    );
  });

  it("Can distribute both ETH and ERC20 coins to one person", async () => {
    const to = getRandomAddress();
    const amount = constants.One;
    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(constants.AddressZero);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }], [{ to, amount }]], {
      limit: [amount, amount],
      tokenAddresses: [constants.AddressZero, erc20.address],
    });

    expect(await provider.getBalance(to)).to.eq(constants.One);
    expect(await erc20.balanceOf(to)).to.eq(constants.One);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawnToken.add(constants.One),
    );
    expect(await getTotalAmountWithdrawn(constants.AddressZero)).to.eq(
      preAmountWithdrawnEth.add(constants.One),
    );
  });

  it("Can distribute a split of ETH and ERC20 coins to two people", async () => {
    const to1 = getRandomAddress();
    const amount1 = constants.One;

    const to2 = getRandomAddress();
    const amount2 = constants.One;

    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(constants.AddressZero);

    await interpretOutcomeAndExecuteEffect(
      [[{ to: to1, amount: amount1 }], [{ to: to2, amount: amount2 }]],
      {
        limit: [amount1, amount2],
        tokenAddresses: [constants.AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(constants.One);
    expect(await erc20.balanceOf(to2)).to.eq(constants.One);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawnToken.add(constants.One),
    );
    expect(await getTotalAmountWithdrawn(constants.AddressZero)).to.eq(
      preAmountWithdrawnEth.add(constants.One),
    );
  });

  it("Can distribute a mix of ETH and ERC20 coins to two people", async () => {
    const to1 = getRandomAddress();
    const amount1 = constants.One;

    const to2 = getRandomAddress();
    const amount2 = constants.One;

    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(constants.AddressZero);

    await interpretOutcomeAndExecuteEffect(
      [
        [
          { to: to1, amount: amount1 },
          { to: to2, amount: amount2 },
        ],
        [
          { to: to1, amount: amount1 },
          { to: to2, amount: amount2 },
        ],
      ],
      {
        limit: [amount1.add(amount2), amount1.add(amount2)],
        tokenAddresses: [constants.AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(constants.One);
    expect(await erc20.balanceOf(to1)).to.eq(constants.One);

    expect(await provider.getBalance(to2)).to.eq(constants.One);
    expect(await erc20.balanceOf(to2)).to.eq(constants.One);

    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawnToken.add(constants.One).add(constants.One),
    );
    expect(await getTotalAmountWithdrawn(constants.AddressZero)).to.eq(
      preAmountWithdrawnEth.add(constants.One).add(constants.One),
    );
  });

  it("Can distribute a mix of ETH and ERC20 coins to an unorderded list of people", async () => {
    const to1 = getRandomAddress();
    const amount1 = constants.One;

    const to2 = getRandomAddress();
    const amount2 = constants.One;

    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(constants.AddressZero);

    await interpretOutcomeAndExecuteEffect(
      [
        [
          { to: to2, amount: amount2 },
          { to: to1, amount: amount1 },
        ],
        [
          { to: to1, amount: amount1 },
          { to: to2, amount: amount2 },
        ],
      ],
      {
        limit: [amount1.add(amount2), amount1.add(amount2)],
        tokenAddresses: [constants.AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(constants.One);
    expect(await erc20.balanceOf(to1)).to.eq(constants.One);

    expect(await provider.getBalance(to2)).to.eq(constants.One);
    expect(await erc20.balanceOf(to2)).to.eq(constants.One);

    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(
      preAmountWithdrawnToken.add(constants.One).add(constants.One),
    );
    expect(await getTotalAmountWithdrawn(constants.AddressZero)).to.eq(
      preAmountWithdrawnEth.add(constants.One).add(constants.One),
    );
  });
});
