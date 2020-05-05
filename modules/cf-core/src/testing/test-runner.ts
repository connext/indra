import { ConnextStore } from "@connext/store";
import { Contract, ContractFactory, BigNumber, providers, constants } from "ethers";
import {
  OutcomeType,
  ProtocolNames,
  ProtocolParams,
  StoreTypes,
  MinimalTransaction,
  SetStateCommitmentJSON,
} from "@connext/types";
import { getSignerAddressFromPublicIdentifier, getRandomAddress, toBNJson } from "@connext/utils";

import { getCreate2MultisigAddress } from "../utils";

import { IdentityApp } from "./contracts";
import { toBeEq } from "./bignumber-jest-matcher";
import { MessageRouter } from "./message-router";
import { MiniNode } from "./mininode";
import { newWallet } from "./utils";
import { StateChannel } from "../models";

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
  public provider!: providers.JsonRpcProvider;
  public defaultTimeout!: BigNumber;
  private mr!: MessageRouter;

  async connectToGanache(): Promise<void> {
    const wallet = newWallet(global["wallet"]);
    const network = global["network"];
    this.provider = wallet.provider as providers.JsonRpcProvider;

    this.identityApp = await new ContractFactory(
      IdentityApp.abi,
      IdentityApp.bytecode,
      wallet,
    ).deploy();

    this.defaultTimeout = BigNumber.from(100);

    this.mininodeA = new MiniNode(network, this.provider, new ConnextStore(StoreTypes.Memory));
    this.mininodeB = new MiniNode(network, this.provider, new ConnextStore(StoreTypes.Memory));
    this.mininodeC = new MiniNode(network, this.provider, new ConnextStore(StoreTypes.Memory));

    this.multisigAB = await getCreate2MultisigAddress(
      this.mininodeA.publicIdentifier,
      this.mininodeB.publicIdentifier,
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      this.provider,
    );

    this.multisigAC = await getCreate2MultisigAddress(
      this.mininodeA.publicIdentifier,
      this.mininodeC.publicIdentifier,
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      this.provider,
    );

    this.multisigBC = await getCreate2MultisigAddress(
      this.mininodeB.publicIdentifier,
      this.mininodeC.publicIdentifier,
      {
        proxyFactory: network.ProxyFactory,
        multisigMastercopy: network.MinimumViableMultisig,
      },
      this.provider,
    );

    this.mr = new MessageRouter([this.mininodeA, this.mininodeB, this.mininodeC]);
  }

  /*
  Run the setup protocol to create the AB and BC channels, and update the
  state channel maps accordingly
  */
  async setup() {
    await this.mininodeA.protocolRunner.runSetupProtocol({
      initiatorIdentifier: this.mininodeA.publicIdentifier,
      responderIdentifier: this.mininodeB.publicIdentifier,
      multisigAddress: this.multisigAB,
    });

    const jsonAB = await this.mininodeA.store.getStateChannel(this.multisigAB);
    this.mininodeA.scm.set(this.multisigAB, StateChannel.fromJson(jsonAB!));

    await this.mr.waitForAllPendingPromises();

    await this.mininodeB.protocolRunner.runSetupProtocol({
      initiatorIdentifier: this.mininodeB.publicIdentifier,
      responderIdentifier: this.mininodeC.publicIdentifier,
      multisigAddress: this.multisigBC,
    });

    const jsonBC = await this.mininodeB.store.getStateChannel(this.multisigBC);
    this.mininodeB.scm.set(this.multisigBC, StateChannel.fromJson(jsonBC!));

    await this.mr.waitForAllPendingPromises();
  }

  /*
  Adds one ETH and one TEST_TOKEN to the free balance of everyone. Note this
  does not actually transfer any tokens.
  */
  async unsafeFund() {
    for (const mininode of [this.mininodeA, this.mininodeB]) {
      const json = await mininode.store.getStateChannel(this.multisigAB)!;
      const sc = StateChannel.fromJson(json!);
      const updatedSc = sc.addActiveAppAndIncrementFreeBalance(constants.HashZero, {
        [constants.AddressZero]: {
          [this.mininodeA.address]: constants.One,
          [this.mininodeB.address]: constants.One,
        },
        [TestRunner.TEST_TOKEN_ADDRESS]: {
          [this.mininodeA.address]: constants.One,
          [this.mininodeB.address]: constants.One,
        },
      });
      await mininode.store.createStateChannel(
        updatedSc.toJson(),
        { to: updatedSc.multisigAddress, value: 0, data: constants.HashZero } as MinimalTransaction,
        {
          appIdentity: updatedSc.freeBalance.identity,
          appIdentityHash: updatedSc.freeBalance.identityHash,
          appStasteHash: updatedSc.freeBalance.hashOfLatestState,
          challengeRegistryAddress: getRandomAddress(),
          signatures: [constants.HashZero, constants.HashZero],
          versionNumber: toBNJson(updatedSc.freeBalance.latestVersionNumber),
        } as any,
      );
      mininode.scm.set(this.multisigAB, updatedSc);
    }

    for (const mininode of [this.mininodeB, this.mininodeC]) {
      const json = await mininode.store.getStateChannel(this.multisigBC)!;
      const sc = StateChannel.fromJson(json!);
      const updatedSc = sc.addActiveAppAndIncrementFreeBalance(constants.HashZero, {
        [constants.AddressZero]: {
          [this.mininodeB.address]: constants.One,
          [this.mininodeC.address]: constants.One,
        },
        [TestRunner.TEST_TOKEN_ADDRESS]: {
          [this.mininodeB.address]: constants.One,
          [this.mininodeC.address]: constants.One,
        },
      });
      await mininode.store.createStateChannel(
        updatedSc.toJson(),
        { to: updatedSc.multisigAddress, value: 0, data: constants.HashZero } as MinimalTransaction,
        {
          appIdentity: updatedSc.freeBalance.identity,
          appIdentityHash: updatedSc.freeBalance.identityHash,
          appStasteHash: updatedSc.freeBalance.hashOfLatestState,
          challengeRegistryAddress: getRandomAddress(),
          signatures: [constants.HashZero, constants.HashZero],
          versionNumber: toBNJson(updatedSc.freeBalance.latestVersionNumber),
        } as any,
      );
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
          to: this.mininodeA.address,
          amount: constants.Two,
        },
        {
          to: this.mininodeB.address,
          amount: constants.Zero,
        },
      ],
      [OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER]: [
        [
          {
            to: this.mininodeA.address,
            amount: constants.Two,
          },
          {
            to: this.mininodeB.address,
            amount: constants.Zero,
          },
        ],
      ],
    }[outcomeType];

    await this.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.propose, {
      multisigAddress: this.multisigAB,
      initiatorIdentifier: this.mininodeA.publicIdentifier,
      responderIdentifier: this.mininodeB.publicIdentifier,
      appDefinition: this.identityApp.address,
      abiEncodings: {
        stateEncoding,
        actionEncoding: undefined,
      },
      initiatorDeposit: constants.One,
      initiatorDepositAssetId: tokenAddress,
      responderDeposit: constants.One,
      responderDepositAssetId: tokenAddress,
      defaultTimeout: this.defaultTimeout,
      stateTimeout: constants.Zero,
      initialState,
      outcomeType,
    } as ProtocolParams.Propose);

    const postProposalStateChannel = await this.mininodeA.store.getStateChannel(this.multisigAB);
    const [proposal] = [
      ...StateChannel.fromJson(postProposalStateChannel!).proposedAppInstances.values(),
    ];

    await this.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.install, {
      appInterface: {
        stateEncoding,
        addr: this.identityApp.address,
        actionEncoding: undefined,
      },
      appSeqNo: proposal.appSeqNo,
      defaultTimeout: this.defaultTimeout,
      stateTimeout: constants.Zero,
      disableLimit: false,
      initialState,
      initiatorBalanceDecrement: constants.One,
      initiatorDepositAssetId: tokenAddress,
      initiatorIdentifier: this.mininodeA.publicIdentifier,
      multisigAddress: this.multisigAB,
      outcomeType,
      responderBalanceDecrement: constants.One,
      responderDepositAssetId: tokenAddress,
      responderIdentifier: this.mininodeB.publicIdentifier,
      appInitiatorIdentifier: this.mininodeA.publicIdentifier,
      appResponderIdentifier: this.mininodeB.publicIdentifier,
    } as ProtocolParams.Install);
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
          to: this.mininodeA.address,
          amount: constants.Two,
        },
        {
          to: this.mininodeB.address,
          amount: constants.Zero,
        },
      ],
      [OutcomeType.MULTI_ASSET_MULTI_PARTY_COIN_TRANSFER]: [
        [
          {
            to: this.mininodeA.address,
            amount: constants.Two,
          },
          {
            to: this.mininodeB.address,
            amount: constants.Zero,
          },
        ],
      ],
    }[outcomeType];

    await this.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.propose, {
      multisigAddress: this.multisigAB,
      initiatorIdentifier: this.mininodeA.publicIdentifier,
      responderIdentifier: this.mininodeB.publicIdentifier,
      appDefinition: this.identityApp.address,
      abiEncodings: {
        stateEncoding,
        actionEncoding: undefined,
      },
      initiatorDeposit: constants.One,
      initiatorDepositAssetId: tokenAddressA,
      responderDeposit: constants.One,
      responderDepositAssetId: tokenAddressB,
      defaultTimeout: this.defaultTimeout,
      stateTimeout: constants.Zero,
      initialState,
      outcomeType,
    } as ProtocolParams.Propose);

    const postProposalStateChannel = await this.mininodeA.store.getStateChannel(this.multisigAB);
    const [proposal] = [
      ...StateChannel.fromJson(postProposalStateChannel!).proposedAppInstances.values(),
    ];

    await this.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.install, {
      outcomeType,
      initialState,
      initiatorIdentifier: this.mininodeA.publicIdentifier,
      responderIdentifier: this.mininodeB.publicIdentifier,
      multisigAddress: this.multisigAB,
      initiatorBalanceDecrement: constants.One,
      responderBalanceDecrement: constants.One,
      appInterface: {
        stateEncoding,
        addr: this.identityApp.address,
        actionEncoding: undefined,
      },
      appSeqNo: proposal.appSeqNo,
      defaultTimeout: this.defaultTimeout,
      stateTimeout: constants.Zero,
      initiatorDepositAssetId: tokenAddressA,
      responderDepositAssetId: tokenAddressB,
      disableLimit: false,
      appInitiatorIdentifier: this.mininodeA.publicIdentifier,
      appResponderIdentifier: this.mininodeB.publicIdentifier,
    } as ProtocolParams.Install);
  }

  async uninstall() {
    const multisig = await this.mininodeA.store.getStateChannel(this.multisigAB);
    if (!multisig) {
      throw new Error(`uninstall: Couldn't find multisig for ${this.multisigAC}`);
    }
    const appInstances = StateChannel.fromJson(multisig!).appInstances;

    const [key] = [...appInstances.keys()].filter((key) => {
      return key !== this.mininodeA.scm.get(this.multisigAB)!.freeBalance.identityHash;
    });

    await this.mininodeA.protocolRunner.initiateProtocol(ProtocolNames.uninstall, {
      appIdentityHash: key,
      initiatorIdentifier: this.mininodeA.publicIdentifier,
      responderIdentifier: this.mininodeB.publicIdentifier,
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
            .getBalance(
              tokenAddress,
              getSignerAddressFromPublicIdentifier(mininode.publicIdentifier),
            ),
        ).toBeEq(expected);
      }
    }
  }
}
