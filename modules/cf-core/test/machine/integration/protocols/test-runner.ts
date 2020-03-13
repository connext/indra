import { MemoryStorage as MemoryStoreService } from "@connext/store";
import { OutcomeType } from "@connext/types";
import { Contract, ContractFactory } from "ethers";
import { One, Two, Zero } from "ethers/constants";
import { JsonRpcProvider } from "ethers/providers";
import { BigNumber } from "ethers/utils";

import { CONVENTION_FOR_ETH_TOKEN_ADDRESS } from "../../../../src/constants";
import { Protocol, xkeyKthAddress } from "../../../../src/machine";
import { sortAddresses } from "../../../../src/machine/xkeys";
import { getCreate2MultisigAddress } from "../../../../src/utils";
import { IdentityApp } from "../../../contracts";
import { toBeEq } from "../bignumber-jest-matcher";
import { connectToGanache } from "../connect-ganache";
import { MessageRouter } from "../message-router";
import { MiniNode } from "../mininode";
import { Store } from "../../../../src/store";

expect.extend({ toBeEq });

export enum Participant {
  A,
  B,
  C,
}

export class TestRunner {
  static readonly TEST_TOKEN_ADDRESS: string = "0x88a5C2d9919e46F883EB62F7b8Dd9d0CC45bc290";

  private identityApp!: Contract;
  public mininodeA!: MiniNode;
  public mininodeB!: MiniNode;
  public mininodeC!: MiniNode;
  public multisigAB!: string;
  public multisigAC!: string;
  public multisigBC!: string;
  public provider!: JsonRpcProvider;
  private mr!: MessageRouter;

  async connectToGanache(): Promise<void> {
    const [provider, wallet] = await connectToGanache();
    this.provider = provider;
    const network = global["networkContext"];

    this.identityApp = await new ContractFactory(
      IdentityApp.abi,
      IdentityApp.evm.bytecode,
      wallet,
    ).deploy();

    this.mininodeA = new MiniNode(network, provider, new Store(new MemoryStoreService()));
    this.mininodeB = new MiniNode(network, provider, new Store(new MemoryStoreService()));
    this.mininodeC = new MiniNode(network, provider, new Store(new MemoryStoreService()));

    this.multisigAB = await getCreate2MultisigAddress(
      [this.mininodeA.xpub, this.mininodeB.xpub],
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      provider,
    );

    this.multisigAC = await getCreate2MultisigAddress(
      [this.mininodeA.xpub, this.mininodeC.xpub],
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      provider,
    );

    this.multisigBC = await getCreate2MultisigAddress(
      [this.mininodeB.xpub, this.mininodeC.xpub],
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      provider,
    );

    this.mr = new MessageRouter([this.mininodeA, this.mininodeB, this.mininodeC]);
  }

  /*
  Run the setup protocol to create the AB and BC channels, and update the
  state channel maps accordingly
  */
  async setup() {
    await this.mininodeA.protocolRunner.runSetupProtocol({
      initiatorXpub: this.mininodeA.xpub,
      responderXpub: this.mininodeB.xpub,
      multisigAddress: this.multisigAB,
    });

    await this.mininodeA.store.getStateChannel(this.multisigAB);
    this.mininodeA.scm.set(
      this.multisigAB,
      await this.mininodeA.store.getStateChannel(this.multisigAB),
    );

    await this.mr.waitForAllPendingPromises();

    await this.mininodeB.protocolRunner.runSetupProtocol({
      initiatorXpub: this.mininodeB.xpub,
      responderXpub: this.mininodeC.xpub,
      multisigAddress: this.multisigBC,
    });

    this.mininodeB.scm.set(
      this.multisigBC,
      await this.mininodeB.store.getStateChannel(this.multisigBC),
    );

    await this.mr.waitForAllPendingPromises();
  }

  /*
  Adds one ETH and one TEST_TOKEN to the free balance of everyone. Note this
  does not actually transfer any tokens.
  */
  async unsafeFund() {
    for (const mininode of [this.mininodeA, this.mininodeB]) {
      const sc = await mininode.store.getStateChannel(this.multisigAB)!;
      const updatedBalance = sc.incrementFreeBalance({
        [CONVENTION_FOR_ETH_TOKEN_ADDRESS]: {
          [sc.getFreeBalanceAddrOf(this.mininodeA.xpub)]: One,
          [sc.getFreeBalanceAddrOf(this.mininodeB.xpub)]: One,
        },
        [TestRunner.TEST_TOKEN_ADDRESS]: {
          [sc.getFreeBalanceAddrOf(this.mininodeA.xpub)]: One,
          [sc.getFreeBalanceAddrOf(this.mininodeB.xpub)]: One,
        },
      });
      await mininode.store.saveStateChannel(updatedBalance);
      mininode.scm.set(this.multisigAB, updatedBalance);
    }

    for (const mininode of [this.mininodeB, this.mininodeC]) {
      const sc = await mininode.store.getStateChannel(this.multisigBC)!;
      const updatedSc = sc.incrementFreeBalance({
        [CONVENTION_FOR_ETH_TOKEN_ADDRESS]: {
          [sc.getFreeBalanceAddrOf(this.mininodeB.xpub)]: One,
          [sc.getFreeBalanceAddrOf(this.mininodeC.xpub)]: One,
        },
        [TestRunner.TEST_TOKEN_ADDRESS]: {
          [sc.getFreeBalanceAddrOf(this.mininodeB.xpub)]: One,
          [sc.getFreeBalanceAddrOf(this.mininodeC.xpub)]: One,
        },
      });
      await mininode.store.saveStateChannel(updatedSc);
      mininode.scm.set(this.multisigBC, updatedSc);
    }
  }

  async installEqualDeposits(outcomeType: OutcomeType, tokenAddress: string) {
    const stateEncoding = {
      [OutcomeType.TWO_PARTY_FIXED_OUTCOME]: "uint8",
      [OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER]: "tuple(address to, uint256 amount)[2]",
      [OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER]: "tuple(address to, uint256 amount)[][]",
    }[outcomeType];

    const initialState = {
      [OutcomeType.TWO_PARTY_FIXED_OUTCOME]: 0,
      [OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER]: [
        {
          to: xkeyKthAddress(this.mininodeA.xpub, 0),
          amount: Two,
        },
        {
          to: xkeyKthAddress(this.mininodeB.xpub, 0),
          amount: Zero,
        },
      ],
      [OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER]: [
        [
          {
            to: xkeyKthAddress(this.mininodeA.xpub, 0),
            amount: Two,
          },
          {
            to: xkeyKthAddress(this.mininodeB.xpub, 0),
            amount: Zero,
          },
        ],
      ],
    }[outcomeType];

    const participants = sortAddresses([
      xkeyKthAddress(this.mininodeA.xpub, 1),
      xkeyKthAddress(this.mininodeB.xpub, 1),
    ]);

    await this.mininodeA.protocolRunner.initiateProtocol(Protocol.Install, {
      appInterface: {
        stateEncoding,
        addr: this.identityApp.address,
        actionEncoding: undefined,
      },
      appSeqNo: 1,
      defaultTimeout: 40,
      disableLimit: false,
      initialState,
      initiatorBalanceDecrement: One,
      initiatorDepositTokenAddress: tokenAddress,
      initiatorXpub: this.mininodeA.xpub,
      multisigAddress: this.multisigAB,
      outcomeType,
      participants,
      responderBalanceDecrement: One,
      responderDepositTokenAddress: tokenAddress,
      responderXpub: this.mininodeB.xpub,
    });
  }

  async installSplitDeposits(
    outcomeType: OutcomeType,
    tokenAddressA: string,
    tokenAddressB: string,
  ) {
    const stateEncoding = {
      [OutcomeType.TWO_PARTY_FIXED_OUTCOME]: "uint8",
      [OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER]: "tuple(address to, uint256 amount)[2]",
      [OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER]: "tuple(address to, uint256 amount)[][]",
    }[outcomeType];

    const initialState = {
      [OutcomeType.TWO_PARTY_FIXED_OUTCOME]: 0,
      [OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER]: [
        {
          to: xkeyKthAddress(this.mininodeA.xpub, 0),
          amount: Two,
        },
        {
          to: xkeyKthAddress(this.mininodeB.xpub, 0),
          amount: Zero,
        },
      ],
      [OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER]: [
        [
          {
            to: xkeyKthAddress(this.mininodeA.xpub, 0),
            amount: Two,
          },
          {
            to: xkeyKthAddress(this.mininodeB.xpub, 0),
            amount: Zero,
          },
        ],
      ],
    }[outcomeType];

    const participants = sortAddresses([
      xkeyKthAddress(this.mininodeA.xpub, 1),
      xkeyKthAddress(this.mininodeB.xpub, 1),
    ]);

    await this.mininodeA.protocolRunner.initiateProtocol(Protocol.Install, {
      participants,
      outcomeType,
      initialState,
      initiatorXpub: this.mininodeA.xpub,
      responderXpub: this.mininodeB.xpub,
      multisigAddress: this.multisigAB,
      initiatorBalanceDecrement: One,
      responderBalanceDecrement: One,
      appInterface: {
        stateEncoding,
        addr: this.identityApp.address,
        actionEncoding: undefined,
      },
      appSeqNo: 1,
      defaultTimeout: 40,
      initiatorDepositTokenAddress: tokenAddressA,
      responderDepositTokenAddress: tokenAddressB,
      disableLimit: false,
    });
  }

  async uninstall() {
    const multisig = await this.mininodeA.store.getStateChannel(this.multisigAB);
    if (!multisig) {
      throw new Error(`uninstall: Couldn't find multisig for ${this.multisigAC}`);
    }
    const appInstances = multisig.appInstances;

    const [key] = [...appInstances.keys()].filter(key => {
      return key !== this.mininodeA.scm.get(this.multisigAB)!.freeBalance.identityHash;
    });

    await this.mininodeA.protocolRunner.initiateProtocol(Protocol.Uninstall, {
      appIdentityHash: key,
      initiatorXpub: this.mininodeA.xpub,
      responderXpub: this.mininodeB.xpub,
      multisigAddress: this.multisigAB,
    });

    await this.mr.waitForAllPendingPromises();
  }

  assertFB(participant: Participant, tokenAddress: string, expected: BigNumber) {
    const mininode = {
      [Participant.A]: this.mininodeA,
      [Participant.B]: this.mininodeB,
      [Participant.C]: this.mininodeC,
    }[participant];
    for (const multisig in [this.multisigAB, this.multisigBC, this.multisigAC]) {
      if (mininode.scm.has(multisig)) {
        expect(
          mininode.scm
            .get(multisig)!
            .getFreeBalanceClass()
            .getBalance(tokenAddress, xkeyKthAddress(mininode.xpub, 0)),
        ).toBeEq(expected);
      }
    }
  }
}
