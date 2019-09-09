import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/typeorm";
import { AddressZero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";
import { Connection } from "typeorm";

import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { defaultPaymentProfileEth, CFCoreProviderId } from "../constants";
import { DatabaseModule } from "../database/database.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { PaymentProfile } from "../paymentProfile/paymentProfile.entity";
import {
  clearDb,
  createTestChannel,
  mkAddress,
  mkXpub,
  mockCFCoreProvider,
  mockStateDepositHolderAddress,
} from "../test";

import { ChannelRepository } from "./channel.repository";
import { ChannelService } from "./channel.service";

describe("ChannelService", () => {
  let service: ChannelService;
  let module: TestingModule;
  let connection: Connection;
  let channelRepository: ChannelRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule, ChannelModule, CFCoreModule, DatabaseModule],
    })
      .overrideProvider(CFCoreProviderId)
      .useValue(mockCFCoreProvider)
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
    const tokenAddress = mkAddress("0xeee");

    const channel = await createTestChannel(channelRepository);

    let profile = new PaymentProfile();
    profile.amountToCollateralize = bigNumberify(2000);
    profile.minimumMaintainedCollateral = bigNumberify(600);
    profile.assetId = AddressZero;
    await channelRepository.addPaymentProfileToChannel(channel.userPublicIdentifier, profile);

    profile = new PaymentProfile();
    profile.amountToCollateralize = bigNumberify(3000);
    profile.minimumMaintainedCollateral = bigNumberify(1000);
    profile.assetId = tokenAddress;
    await channelRepository.addPaymentProfileToChannel(channel.userPublicIdentifier, profile);

    profile = await channelRepository.getPaymentProfileForChannelAndToken(
      channel.userPublicIdentifier,
    );

    expect(profile.amountToCollateralize).toStrictEqual(bigNumberify(2000));
    expect(profile.minimumMaintainedCollateral).toStrictEqual(bigNumberify(600));

    profile = await channelRepository.getPaymentProfileForChannelAndToken(
      channel.userPublicIdentifier,
      tokenAddress,
    );

    expect(profile.amountToCollateralize).toStrictEqual(bigNumberify(3000));
    expect(profile.minimumMaintainedCollateral).toStrictEqual(bigNumberify(1000));
  });

  it("should get a default payment profile", async () => {
    const channel = await createTestChannel(channelRepository);

    const profile = await channelRepository.getPaymentProfileForChannelAndToken(
      channel.userPublicIdentifier,
    );

    expect(profile.amountToCollateralize).toStrictEqual(
      bigNumberify(defaultPaymentProfileEth.amountToCollateralize),
    );
    expect(profile.minimumMaintainedCollateral).toStrictEqual(
      bigNumberify(defaultPaymentProfileEth.minimumMaintainedCollateral),
    );
  });

  it("should overwrite a payment profile", async () => {
    const tokenAddress = mkAddress("0xeee");
    const channel = await createTestChannel(channelRepository);
    let profile = new PaymentProfile();
    profile.amountToCollateralize = bigNumberify(2000);
    profile.minimumMaintainedCollateral = bigNumberify(600);
    profile.assetId = tokenAddress;
    await channelRepository.addPaymentProfileToChannel(channel.userPublicIdentifier, profile);

    profile = await channelRepository.getPaymentProfileForChannelAndToken(
      channel.userPublicIdentifier,
      tokenAddress,
    );

    expect(profile.amountToCollateralize).toStrictEqual(bigNumberify(2000));
    expect(profile.minimumMaintainedCollateral).toStrictEqual(bigNumberify(600));

    profile = new PaymentProfile();
    profile.amountToCollateralize = bigNumberify(4000);
    profile.minimumMaintainedCollateral = bigNumberify(1200);
    profile.assetId = tokenAddress;
    await channelRepository.addPaymentProfileToChannel(channel.userPublicIdentifier, profile);

    profile = await channelRepository.getPaymentProfileForChannelAndToken(
      channel.userPublicIdentifier,
      tokenAddress,
    );

    expect(profile.amountToCollateralize).toStrictEqual(bigNumberify(4000));
    expect(profile.minimumMaintainedCollateral).toStrictEqual(bigNumberify(1200));
  });
});
