import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { One, AddressZero, Zero } from "ethers/constants";
import { JsonRpcProvider, TransactionResponse } from "ethers/providers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { mkHash, mkXpub } from "../test/utils";
import { CFCoreTypes, AppInstanceJson } from "../util";

import { Channel } from "./channel.entity";
import { ChannelService, RebalanceType } from "./channel.service";
import { ChannelRepository } from "./channel.repository";
import { mkAddress } from "../../dist/src/test/utils";
import { ConfigService } from "../config/config.service";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { BigNumber } from "ethers/utils";
import { DefaultApp, OutcomeType } from "@connext/types";

class MockCFCoreService {
  cfCore = {
    freeBalanceAddress: mkAddress("0xabcdef"),
  };

  async deposit(): Promise<CFCoreTypes.DepositResult> {
    console.log("Called mock function deposit()");
    return {
      multisigBalance: One,
      tokenAddress: AddressZero,
      transactionHash: mkHash("0xa"),
    };
  }

  async proposeAndWaitForAccepted(): Promise<CFCoreTypes.ProposeInstallResult> {
    return {
      appInstanceId: mkHash("0xabc"),
    };
  }

  async getCoinBalanceRefundApp(): Promise<AppInstanceJson | undefined> {
    return undefined;
  }
}

class MockChannelRepository extends ChannelRepository {
  async findByMultisigAddress(): Promise<Channel | undefined> {
    const channel = new Channel();
    channel.available = true;
    channel.collateralizationInFlight = false;
    channel.multisigAddress = mkAddress("0xAAA");
    channel.nodePublicIdentifier = mkXpub("xpubAAA");
    channel.userPublicIdentifier = mkXpub("xpubBBB");
    channel.id = 1;
    return channel;
  }
}

class MockOnchainTransactionRepository extends OnchainTransactionRepository {
  async addCollateralization(): Promise<OnchainTransaction> {
    return new OnchainTransaction();
  }
}

class MockEthProvider {
  async getTransaction(): Promise<TransactionResponse> {
    return {
      blockHash: mkHash(),
      blockNumber: 1,
      chainId: 1337,
      confirmations: 10,
      data: "0x",
      from: mkAddress("0xabc"),
      gasLimit: One,
      gasPrice: One,
      hash: mkHash("0xbbb"),
      nonce: 1,
      r: "foo",
      s: "bar",
      timestamp: 111,
      to: mkAddress("0xdef"),
      v: 1,
      value: Zero,
    } as any;
  }

  async getBalance(): Promise<BigNumber> {
    return One;
  }
}

class MockConfigService {
  getEthProvider(): JsonRpcProvider {
    return new MockEthProvider() as any;
  }

  async getDefaultAppByName(): Promise<DefaultApp> {
    return {
      actionEncoding: "",
      allowNodeInstall: true,
      appDefinitionAddress: mkAddress("0xa"),
      chainId: 1337,
      name: "SimpleLinkedTransferApp",
      outcomeType: OutcomeType.SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER,
      stateEncoding: "",
    };
  }
}

describe.skip("Channel Service", () => {
  let channelService: ChannelService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelService,
        { provide: ConfigService, useClass: MockConfigService },
        { provide: CFCoreService, useClass: MockCFCoreService },
        { provide: getRepositoryToken(Channel), useClass: MockChannelRepository },
        { provide: getRepositoryToken(OnchainTransaction), useClass: MockOnchainTransactionRepository },
      ],
    }).compile();
    channelService = moduleRef.get<ChannelService>(ChannelService);
    console.log("channelService: ", channelService);
  });

  it("should add deposits to the onchain transaction table", async () => {
    await channelService.rebalance(mkXpub("0xXpub"), AddressZero, RebalanceType.COLLATERALIZE, One);
  });
});
