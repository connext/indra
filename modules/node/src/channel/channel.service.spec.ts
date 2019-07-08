import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/typeorm";
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
  mkXpub,
  mockNodeProvider,
  mockNodePublicIdentifier,
  mockStateDepositHolderAddress,
} from "../test";
import { toBig } from "../util";

import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

describe("ChannelService", () => {
  let service: ChannelService;
  let module: TestingModule;
  let connection: Connection;
  let channelRepository: ChannelRepository;
  let paymentProfileRepository: PaymentProfileRepository;

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
    paymentProfileRepository = connection.getCustomRepository(PaymentProfileRepository);
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
    let channel = await service.create(userXpub);

    expect(channel.multisigAddress).toBe(mockStateDepositHolderAddress);
    expect(channel.nodePublicIdentifier).toBe(mockNodePublicIdentifier);
    expect(channel.userPublicIdentifier).toBe(userXpub);
    expect(channel.available).toBe(false);

    channel = await service.makeAvailable(mockStateDepositHolderAddress);
    expect(channel.available).toBe(true);
  });

  it("should find a payment profile for a channel", async () => {
    const userXpub = mkXpub("xpubA");
    const channel = await service.create(userXpub);

    let profile = new PaymentProfile();
    profile.amountToCollateralizeWei = toBig(2000);
    profile.minimumMaintainedCollateralWei = toBig(600);
    profile.channels = [channel!];
    await paymentProfileRepository.save(profile);

    profile = await channelRepository.getPaymentProfileForChannel(userXpub);

    expect(profile.amountToCollateralizeWei).toStrictEqual(toBig(2000));
    expect(profile.minimumMaintainedCollateralWei).toStrictEqual(toBig(600));
  });
});
