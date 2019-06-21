import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, TypeOrmModule } from "@nestjs/typeorm";
import { Zero } from "ethers/constants";
import { Connection } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { entities, viewEntites } from "../app.module";
import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { NodeModule } from "../node/node.module";
import { clearDb, mkAddress, mkXpub } from "../test";
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

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ChannelModule,
        NodeModule,
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (config: ConfigService): Promise<any> => {
            return {
              ...config.getPostgresConfig(),
              entities: [...entities, ...viewEntites],
              synchronize: true,
              type: "postgres",
            } as PostgresConnectionOptions;
          },
        }),
      ],
    }).compile();

    service = module.get<ChannelService>(ChannelService);
    connection = module.get<Connection>(getConnectionToken());
    userRepository = connection.getCustomRepository(UserRepository);
    channelRepository = connection.getCustomRepository(ChannelRepository);
    channelUpdateRepository = connection.getCustomRepository(ChannelUpdateRepository);
    nodeChannelRepository = connection.getCustomRepository(NodeChannelRepository);
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
    user.xpub = mkXpub("xpubA");

    let channel = new Channel();
    channel.user = user;
    channel.counterpartyXpub = mkXpub("xpubB");
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
    user.xpub = mkXpub("xpubC");

    channel = new Channel();
    channel.user = user;
    channel.counterpartyXpub = mkXpub("xpubD");
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

    let nodeChannel = await nodeChannelRepository.findByXpub(mkXpub("xpubA"));
    expect(nodeChannel.freeBalancePartyA).toBe("1");
    expect(nodeChannel.freeBalancePartyB).toBe("2");
    expect(nodeChannel.nonce).toBe(2);

    nodeChannel = await nodeChannelRepository.findByXpub(mkXpub("xpubC"));
    expect(nodeChannel.freeBalancePartyA).toBe("3");
    expect(nodeChannel.freeBalancePartyB).toBe("4");
    expect(nodeChannel.nonce).toBe(1);
  });
});
