import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/typeorm";
import { Zero } from "ethers/constants";
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
  mockNodePublicIdentifier,
  mockStateDepositHolderAddress,
} from "../test";
import { User } from "../user/user.entity";
import { UserRepository } from "../user/user.repository";
import { toBig } from "../util";

import { Channel, ChannelUpdate } from "./channel.entity";
import {
  ChannelRepository,
  ChannelUpdateRepository,
  NodeChannelRepository,
} from "./channel.repository";
import { ChannelService } from "./channel.service";

describe("ChannelService", () => {
  let service: ChannelService;
  let module: TestingModule;
  let connection: Connection;
  let userRepository: UserRepository;
  let channelRepository: ChannelRepository;
  let channelUpdateRepository: ChannelUpdateRepository;
  let nodeChannelRepository: NodeChannelRepository;
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
    userRepository = connection.getCustomRepository(UserRepository);
    channelRepository = connection.getCustomRepository(ChannelRepository);
    channelUpdateRepository = connection.getCustomRepository(ChannelUpdateRepository);
    nodeChannelRepository = connection.getCustomRepository(NodeChannelRepository);
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

  it("should find node channels", async () => {
    // channel with 3 updates
    let user = new User();
    user.publicIdentifier = mkXpub("xpubA");

    let channel = new Channel();
    channel.user = user;
    channel.nodePublicIdentifier = mkXpub("xpubB");
    channel.multisigAddress = mkAddress("0xa");

    let update = new ChannelUpdate();
    update.channel = channel;
    update.freeBalancePartyA = Zero;
    update.freeBalancePartyB = Zero;
    update.nonce = 0;

    await userRepository.save(user);
    await channelRepository.save(channel);
    await channelUpdateRepository.save(update);

    update = new ChannelUpdate();
    update.channel = channel;
    update.freeBalancePartyA = Zero;
    update.freeBalancePartyB = Zero;
    update.nonce = 1;
    await channelUpdateRepository.save(update);

    update = new ChannelUpdate();
    update.channel = channel;
    update.freeBalancePartyA = toBig(1);
    update.freeBalancePartyB = toBig(2);
    update.nonce = 2;
    await channelUpdateRepository.save(update);

    // channel with 3 updates
    user = new User();
    user.publicIdentifier = mkXpub("xpubC");

    channel = new Channel();
    channel.user = user;
    channel.nodePublicIdentifier = mkXpub("xpubD");
    channel.multisigAddress = mkAddress("0xb");

    update = new ChannelUpdate();
    update.channel = channel;
    update.freeBalancePartyA = Zero;
    update.freeBalancePartyB = Zero;
    update.nonce = 0;

    await userRepository.save(user);
    await channelRepository.save(channel);
    await channelUpdateRepository.save(update);

    update = new ChannelUpdate();
    update.channel = channel;
    update.freeBalancePartyA = toBig(3);
    update.freeBalancePartyB = toBig(4);
    update.nonce = 1;
    await channelUpdateRepository.save(update);

    let nodeChannel = await nodeChannelRepository.findByUserPublicIdentifier(mkXpub("xpubA"));
    expect(nodeChannel.multisigAddress).toBe(mkAddress("0xa"));
    expect(nodeChannel.freeBalancePartyA).toBe("1");
    expect(nodeChannel.freeBalancePartyB).toBe("2");
    expect(nodeChannel.nonce).toBe(2);

    nodeChannel = await nodeChannelRepository.findByUserPublicIdentifier(mkXpub("xpubC"));
    expect(nodeChannel.multisigAddress).toBe(mkAddress("0xb"));
    expect(nodeChannel.freeBalancePartyA).toBe("3");
    expect(nodeChannel.freeBalancePartyB).toBe("4");
    expect(nodeChannel.nonce).toBe(1);
  });

  it("should create a channel and make it available", async () => {
    const userXpub = mkXpub("xpubA");
    const nodeChannel = await service.create(userXpub);

    expect(nodeChannel.multisigAddress).toBe(mockStateDepositHolderAddress);
    expect(nodeChannel.nodePublicIdentifier).toBe(mockNodePublicIdentifier);
    expect(nodeChannel.userPublicIdentifier).toBe(userXpub);
    expect(nodeChannel.freeBalancePartyA).toBe(Zero.toString());
    expect(nodeChannel.freeBalancePartyB).toBe(Zero.toString());
    expect(nodeChannel.nonce).toBe(0);
    expect(nodeChannel.available).toBe(false);

    const channel = await service.makeAvailable(mockStateDepositHolderAddress);
    expect(channel.available).toBe(true);
  });

  it("should find a payment profile for a channel", async () => {
    const userXpub = mkXpub("xpubA");
    const nodeChannel = await service.create(userXpub);
    const channel = await channelRepository.findOne(nodeChannel.channelId);

    let profile = new PaymentProfile();
    profile.amountToCollateralizeWei = toBig(2000);
    profile.amountToCollateralizeToken = toBig(1000);
    profile.minimumMaintainedCollateralWei = toBig(600);
    profile.minimumMaintainedCollateralToken = toBig(500);
    profile.channels = [channel!];
    await paymentProfileRepository.save(profile);

    profile = await channelRepository.getPaymentProfileForChannel(userXpub);

    expect(profile.amountToCollateralizeWei).toStrictEqual(toBig(2000));
    expect(profile.amountToCollateralizeToken).toStrictEqual(toBig(1000));
    expect(profile.minimumMaintainedCollateralWei).toStrictEqual(toBig(600));
    expect(profile.minimumMaintainedCollateralToken).toStrictEqual(toBig(500));
  });
});
