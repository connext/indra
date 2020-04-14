import { createRandomAddress } from "@connext/utils";
import { Contract, Wallet, ContractFactory } from "ethers";
import { AddressZero, One } from "ethers/constants";
import { BigNumber, defaultAbiCoder } from "ethers/utils";

import DolphinCoin from "../../build/DolphinCoin.json";
import MultiAssetMultiPartyCoinTransferInterpreter from "../../build/MultiAssetMultiPartyCoinTransferInterpreter.json";

import { expect, provider } from "../utils";

type CoinTransfer = {
  to: string;
  amount: BigNumber;
};

function encodeParams(params: { limit: BigNumber[]; tokenAddresses: string[] }) {
  return defaultAbiCoder.encode([`tuple(uint256[] limit, address[] tokenAddresses)`], [params]);
}

function encodeOutcome(state: CoinTransfer[][]) {
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
}

describe("MultiAssetMultiPartyCoinTransferInterpreter", () => {
  let wallet: Wallet;
  let erc20: Contract;
  let multiAssetMultiPartyCoinTransferInterpreter: Contract;

  async function interpretOutcomeAndExecuteEffect(
    state: CoinTransfer[][],
    params: { limit: BigNumber[]; tokenAddresses: string[] },
  ) {
    return await multiAssetMultiPartyCoinTransferInterpreter
      .functions
      .interpretOutcomeAndExecuteEffect(
        encodeOutcome(state),
        encodeParams(params),
      );
  }

  async function getTotalAmountWithdrawn(assetId: string) {
    return multiAssetMultiPartyCoinTransferInterpreter
      .functions
      .totalAmountWithdrawn(assetId);
  }

  beforeEach(async () => {
    wallet = (await provider.getWallets())[0];
    erc20 = await new ContractFactory(
      DolphinCoin.abi,
      DolphinCoin.bytecode,
      wallet,
    ).deploy();

    multiAssetMultiPartyCoinTransferInterpreter = await new ContractFactory(
      MultiAssetMultiPartyCoinTransferInterpreter.abi,
      MultiAssetMultiPartyCoinTransferInterpreter.bytecode,
      wallet,
    ).deploy();

    // fund interpreter with ERC20 tokenAddresses
    await erc20.functions.transfer(
      multiAssetMultiPartyCoinTransferInterpreter.address,
      erc20.functions.balanceOf(wallet.address),
    );

    // fund interpreter with ETH
    await wallet.sendTransaction({
      to: multiAssetMultiPartyCoinTransferInterpreter.address,
      value: new BigNumber(100),
    });
  });

  it("Can distribute ETH coins only correctly to one person", async () => {
    const to = createRandomAddress();
    const amount = One;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(AddressZero);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }]], {
      limit: [amount],
      tokenAddresses: [AddressZero],
    });

    expect(await provider.getBalance(to)).to.eq(One);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawn.add(One));
  });

  it("Can distribute ETH coins only correctly two people", async () => {
    const to1 = createRandomAddress();
    const amount1 = One;

    const to2 = createRandomAddress();
    const amount2 = One;
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

    expect(await provider.getBalance(to1)).to.eq(One);
    expect(await provider.getBalance(to2)).to.eq(One);
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawn.add(One).add(One));
  });

  it("Can distribute ERC20 coins correctly for one person", async () => {
    const to = createRandomAddress();
    const amount = One;
    const preAmountWithdrawn = await getTotalAmountWithdrawn(erc20.address);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }]], {
      limit: [amount],
      tokenAddresses: [erc20.address],
    });

    expect(await erc20.functions.balanceOf(to)).to.eq(One);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(preAmountWithdrawn.add(One));
  });

  it("Can distribute ERC20 coins only correctly two people", async () => {
    const to1 = createRandomAddress();
    const amount1 = One;

    const to2 = createRandomAddress();
    const amount2 = One;

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

    expect(await erc20.functions.balanceOf(to1)).to.eq(One);
    expect(await erc20.functions.balanceOf(to2)).to.eq(One);
    expect(
      await getTotalAmountWithdrawn(erc20.address),
    ).to.eq(preAmountWithdrawn.add(One).add(One));
  });

  it("Can distribute both ETH and ERC20 coins to one person", async () => {
    const to = createRandomAddress();
    const amount = One;
    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);

    await interpretOutcomeAndExecuteEffect([[{ to, amount }], [{ to, amount }]], {
      limit: [amount, amount],
      tokenAddresses: [AddressZero, erc20.address],
    });

    expect(await provider.getBalance(to)).to.eq(One);
    expect(await erc20.functions.balanceOf(to)).to.eq(One);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(preAmountWithdrawnToken.add(One));
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawnEth.add(One));
  });

  it("Can distribute a split of ETH and ERC20 coins to two people", async () => {
    const to1 = createRandomAddress();
    const amount1 = One;

    const to2 = createRandomAddress();
    const amount2 = One;

    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);

    await interpretOutcomeAndExecuteEffect(
      [[{ to: to1, amount: amount1 }], [{ to: to2, amount: amount2 }]],
      {
        limit: [amount1, amount2],
        tokenAddresses: [AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(One);
    expect(await erc20.functions.balanceOf(to2)).to.eq(One);
    expect(await getTotalAmountWithdrawn(erc20.address)).to.eq(preAmountWithdrawnToken.add(One));
    expect(await getTotalAmountWithdrawn(AddressZero)).to.eq(preAmountWithdrawnEth.add(One));
  });

  it("Can distribute a mix of ETH and ERC20 coins to two people", async () => {
    const to1 = createRandomAddress();
    const amount1 = One;

    const to2 = createRandomAddress();
    const amount2 = One;

    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);

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
        tokenAddresses: [AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(One);
    expect(await erc20.functions.balanceOf(to1)).to.eq(One);

    expect(await provider.getBalance(to2)).to.eq(One);
    expect(await erc20.functions.balanceOf(to2)).to.eq(One);

    expect(
      await getTotalAmountWithdrawn(erc20.address),
    ).to.eq(preAmountWithdrawnToken.add(One).add(One));
    expect(
      await getTotalAmountWithdrawn(AddressZero),
    ).to.eq(preAmountWithdrawnEth.add(One).add(One));
  });

  it("Can distribute a mix of ETH and ERC20 coins to an unorderded list of people", async () => {
    const to1 = createRandomAddress();
    const amount1 = One;

    const to2 = createRandomAddress();
    const amount2 = One;

    const preAmountWithdrawnToken = await getTotalAmountWithdrawn(erc20.address);
    const preAmountWithdrawnEth = await getTotalAmountWithdrawn(AddressZero);

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
        tokenAddresses: [AddressZero, erc20.address],
      },
    );

    expect(await provider.getBalance(to1)).to.eq(One);
    expect(await erc20.functions.balanceOf(to1)).to.eq(One);

    expect(await provider.getBalance(to2)).to.eq(One);
    expect(await erc20.functions.balanceOf(to2)).to.eq(One);

    expect(
      await getTotalAmountWithdrawn(erc20.address),
    ).to.eq(preAmountWithdrawnToken.add(One).add(One));
    expect(
      await getTotalAmountWithdrawn(AddressZero),
    ).to.eq(preAmountWithdrawnEth.add(One).add(One));
  });
});
