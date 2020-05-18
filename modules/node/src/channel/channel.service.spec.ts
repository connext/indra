import { DefaultApp, MethodResults, OutcomeType } from "@connext/types";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BigNumber, providers, constants } from "ethers";

import { CFCoreService } from "../cfCore/cfCore.service";
import { mkHash, mkAddress } from "../test/utils";

import { Channel } from "./channel.entity";
import { ChannelService, RebalanceType } from "./channel.service";
import { ChannelRepository } from "./channel.repository";
import { ConfigService } from "../config/config.service";
import { OnchainTransaction } from "../onchainTransactions/onchainTransaction.entity";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";

const { AddressZero, One, Zero } = constants;

class MockCFCoreService {
  cfCore = {
    signerAddress: mkAddress("0xabcdef"),
  };

  async deposit(): Promise<MethodResults.Deposit> {
    return {
      freeBalance: {
        [AddressZero]: One,
      },
    };
  }
}

class MockChannelRepository extends ChannelRepository {
  async findByMultisigAddress(): Promise<Channel | undefined> {
    const channel = new Channel();
    channel.available = true;
    channel.activeCollateralizations = { [AddressZero]: false };
    channel.multisigAddress = mkAddress("0xAAA");
    channel.nodeIdentifier = mkAddress("addressAAA");
    channel.userIdentifier = mkAddress("addressBBB");
    channel.id = 1;
    return channel;
  }
}

class MockOnchainTransactionRepository extends OnchainTransactionRepository {
  async addCollateralization(): Promise<void> {
    return;
  }
}

class MockEthProvider {
  async getTransaction(): Promise<providers.TransactionResponse> {
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
  getEthProvider(): providers.JsonRpcProvider {
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
        {
          provide: getRepositoryToken(OnchainTransaction),
          useClass: MockOnchainTransactionRepository,
        },
      ],
    }).compile();
    channelService = moduleRef.get<ChannelService>(ChannelService);
  });

  it("should add deposits to the onchain transaction table", async () => {
    await channelService.rebalance(
      mkAddress("0xAddress"),
      AddressZero,
      RebalanceType.COLLATERALIZE,
      One,
    );
  });
});
