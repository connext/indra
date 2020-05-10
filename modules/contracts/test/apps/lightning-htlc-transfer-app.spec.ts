import {
  CoinTransfer,
  HashLockTransferAppAction,
  HashLockTransferAppActionEncoding,
  HashLockTransferAppState,
  HashLockTransferAppStateEncoding,
  singleAssetTwoPartyCoinTransferEncoding,
  SolidityValueType,
} from "@connext/types";
import { Contract, ContractFactory } from "ethers";
import { Zero, One } from "ethers/constants";
import { BigNumber, defaultAbiCoder, soliditySha256, bigNumberify, formatBytes32String } from "ethers/utils";

import LightningHTLCTransferApp from "../../build/HashLockTransferApp.json";

import { expect, provider } from "../utils";


function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

function mkHash(prefix: string = "0xa"): string {
  return prefix.padEnd(66, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode([singleAssetTwoPartyCoinTransferEncoding], encodedAppState)[0];

const decodeAppState = (encodedAppState: string): HashLockTransferAppState =>
  defaultAbiCoder.decode([HashLockTransferAppStateEncoding], encodedAppState)[0];

const encodeAppState = (
  state: HashLockTransferAppState,
  onlyCoinTransfers: boolean = false,
): string => {
  if (!onlyCoinTransfers)
    return defaultAbiCoder.encode([HashLockTransferAppStateEncoding], [state]);
  return defaultAbiCoder.encode([singleAssetTwoPartyCoinTransferEncoding], [state.coinTransfers]);
};

function encodeAppAction(state: SolidityValueType): string {
  return defaultAbiCoder.encode([HashLockTransferAppActionEncoding], [state]);
}

function createLockHash(preImage: string): string {
  return soliditySha256(["bytes32"], [preImage]);
}

describe("LightningHTLCTransferApp", () => {
  let lightningHTLCTransferApp: Contract;
  let preImage: string;

  async function computeOutcome(state: HashLockTransferAppState): Promise<string> {
    return await lightningHTLCTransferApp.functions.computeOutcome(encodeAppState(state));
  }

  async function applyAction(state: any, action: SolidityValueType): Promise<string> {
    return await lightningHTLCTransferApp.functions.applyAction(
      encodeAppState(state),
      encodeAppAction(action),
    );
  }

  async function init(state: HashLockTransferAppState): Promise<string> {
    return await lightningHTLCTransferApp.functions.init(encodeAppState(state));
  }

  async function validateOutcome(
    encodedTransfers: string,
    postState: HashLockTransferAppState,
  ) {
    const decoded = decodeTransfers(encodedTransfers);
    expect(encodedTransfers).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(postState.coinTransfers[0].amount.toString());
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(postState.coinTransfers[1].amount.toString());
  }

  async function getInitialState() {
    preImage = mkHash("0xb");
    const lockHash = createLockHash(preImage);
    const expiry = bigNumberify(await provider.getBlockNumber()).add(10000);
    const preState = {
      coinTransfers: [
        {
          amount: new BigNumber(10000),
          to: mkAddress("0xa"),
        },
        {
          amount: Zero,
          to: mkAddress("0xB"),
        },
      ],
      lockHash,
      expiry,
      preImage: mkHash("0x0"),
      finalized: false,
    };
    return preState;
  }

  beforeEach(async () => {
    const wallet = (await provider.getWallets())[0];
    lightningHTLCTransferApp = await new ContractFactory(
      LightningHTLCTransferApp.abi,
      LightningHTLCTransferApp.bytecode,
      wallet,
    ).deploy();
  });

  it("will pass init with correct state", async() => {
    let preState = await getInitialState();
    const ret = await init(preState)
    expect(ret).to.be.ok
  })

  it("will fail init with zero initiator balance", async() => {
    let preState = await getInitialState();
    preState.coinTransfers[0].amount = Zero;
    await expect(init(preState)).to.be.revertedWith("cannot install hashlock transfer with 0 initiator balance")
  })

  it("will fail init with nonzero responder balance", async() => {
    let preState = await getInitialState();
    preState.coinTransfers[1].amount = One;
    await expect(init(preState)).to.be.revertedWith("cannot install hashlock transfer with nonzero responder balance")
  })

  it("will fail init with populated preimage", async() => {
    let preState = await getInitialState();
    preState.preImage = mkHash("0x1");
    await expect(init(preState)).to.be.revertedWith("cannot install a hashlock transfer with populated preimage")
  })

  it("will fail init with unpopulated lockHash", async() => {
    let preState = await getInitialState();
    preState.lockHash = mkHash("0x0");
    await expect(init(preState)).to.be.revertedWith("cannot install a linked transfer with unpopulated lockHash")
  })

  it("will fail init with expired timelock", async() => {
    let preState = await getInitialState();
    preState.expiry = bigNumberify(await provider.getBlockNumber())
    await expect(init(preState)).to.be.revertedWith("cannot install a hashlock transfer that is already expired")
  })

  it("will fail init with finalized state", async() => {
    let preState = await getInitialState();
    preState.finalized = true;
    await expect(init(preState)).to.be.revertedWith("cannot install a hashlock transfer that is already finalized")
  })

  it("will redeem a payment with correct hash within expiry", async () => {
    let preState = await getInitialState();
    const action: HashLockTransferAppAction = {
      preImage,
    };

    let ret = await applyAction(preState, action);
    const afterActionState = decodeAppState(ret);

    const expectedPostState: HashLockTransferAppState = {
      ...preState,
      coinTransfers: [
        {
          ...preState.coinTransfers[0],
          amount: Zero,
        },
        {
          ...preState.coinTransfers[1],
          amount: preState.coinTransfers[0].amount
        }
      ],
      finalized: true,
    };

    expect(afterActionState.finalized).to.eq(expectedPostState.finalized);
    expect(afterActionState.coinTransfers[0].amount).to.eq(
      expectedPostState.coinTransfers[0].amount,
    );
    expect(afterActionState.coinTransfers[1].amount).to.eq(
      expectedPostState.coinTransfers[1].amount,
    );

    ret = await computeOutcome(afterActionState);
    validateOutcome(ret, expectedPostState);
  });

  it("will revert action with incorrect hash", async () => {
    let preState = await getInitialState();
    const action: HashLockTransferAppAction = {
      preImage: mkHash("0xc"), // incorrect hash
    };

    await expect(applyAction(preState, action)).revertedWith(
      "Hash generated from preimage does not match hash in state",
    );
  });

  it("will revert action if already finalized", async () => {
    let preState = await getInitialState();
    const action: HashLockTransferAppAction = {
      preImage,
    };
    preState.finalized = true;

    await expect(applyAction(preState, action)).revertedWith(
      "Cannot take action on finalized state",
    );
  });

  it("will revert action if timeout has expired", async () => {
    let preState = await getInitialState();
    const action: HashLockTransferAppAction = {
      preImage,
    };
    preState.expiry = bigNumberify(await provider.getBlockNumber());

    await expect(applyAction(preState, action)).revertedWith(
      "Cannot take action if expiry is expired",
    );
  });

  it("will revert outcome that is not finalized with unexpired expiry", async () => {
    let preState = await getInitialState();
    await expect(computeOutcome(preState)).revertedWith(
      "Cannot revert payment if expiry is unexpired",
    );
  });

  it("will refund payment that is not finalized with expired expiry", async () => {
    let preState = await getInitialState();
    preState.expiry = bigNumberify(await provider.getBlockNumber());
    let ret = await computeOutcome(preState);

    validateOutcome(ret, preState);
  });
});
