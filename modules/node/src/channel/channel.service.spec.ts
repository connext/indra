import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/typeorm";
import { AddressZero } from "ethers/constants";
import { Connection } from "typeorm";

import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { NodeProviderId } from "../constants";
import { DatabaseModule } from "../database/database.module";
import { NodeModule } from "../node/node.module";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import { PaymentProfileRepository } from "../paymentProfile/paymentProfile.repository";
import {
  clearDb,
  mkAddress,
  mkXpub,
  mockNodeProvider,
  mockStateDepositHolderAddress,
} from "../test";
import { toBig } from "../util";

import { Channel } from "./channel.entity";
import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

describe("ChannelService", () => {
  let service: ChannelService;
  let module: TestingModule;
  let connection: Connection;
  let channelRepository: ChannelRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule, ChannelModule, NodeModule, DatabaseModule],
    })
      .overrideProvider(NodeProviderId)
      .useValue(mockNodeProvider)
      .compile();

    service = module.get<ChannelService>(ChannelService);
    connection = module.get<Connection>(getConnectionToken());
    channelRepository = connection.getCustomRepository(ChannelRepository);
  });

  beforeEach(async () => {
    await clearDb(connection);
  });

  afterAll(async () => {
    await module.close();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should create a channel and make it available", async () => {
    const userXpub = mkXpub("xpubA");
    const result = await service.create(userXpub);

    expect(result.multisigAddress).toBe(mockStateDepositHolderAddress);
  });

  it("should find payment profiles for a channel", async () => {
    const userXpub = mkXpub("xpubA");
    const tokenAddress = mkAddress("0xeee");

    let channel = new Channel();
    channel.multisigAddress = mkAddress("0xa");
    channel.nodePublicIdentifier = mkXpub("xpubB");
    channel.userPublicIdentifier = userXpub;
    channel = await channelRepository.save(channel);

    let profile = new PaymentProfile();
    profile.amountToCollateralize = toBig(2000);
    profile.minimumMaintainedCollateral = toBig(600);
    profile.channels = [channel!];
    profile.tokenAddress = AddressZero;
    await channelRepository.addPaymentProfileToChannel(userXpub, profile);

    profile = new PaymentProfile();
    profile.amountToCollateralize = toBig(3000);
    profile.minimumMaintainedCollateral = toBig(1000);
    profile.channels = [channel!];
    profile.tokenAddress = tokenAddress;
    await channelRepository.addPaymentProfileToChannel(userXpub, profile);

    profile = await channelRepository.getPaymentProfileForChannelAndToken(userXpub);

    expect(profile.amountToCollateralize).toStrictEqual(toBig(2000));
    expect(profile.minimumMaintainedCollateral).toStrictEqual(toBig(600));

    profile = await channelRepository.getPaymentProfileForChannelAndToken(userXpub, tokenAddress);

    expect(profile.amountToCollateralize).toStrictEqual(toBig(3000));
    expect(profile.minimumMaintainedCollateral).toStrictEqual(toBig(1000));
  });
});
