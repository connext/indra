import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, TypeOrmModule } from "@nestjs/typeorm";
import { Connection } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

import { entities } from "../app.module";
import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { clearDb, mkAddress, mkXpub } from "../test";
import { User } from "../user/user.entity";
import { UserRepository } from "../user/user.repository";

import { ChannelService } from "./channel.service";

describe("ChannelService", () => {
  let service: ChannelService;
  let module: TestingModule;
  let connection: Connection;
  let userRepository: UserRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule, ChannelModule],
          inject: [ConfigService],
          useFactory: async (config: ConfigService) => {
            return {
              ...config.getPostgresConfig(),
              entities,
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

  it("should add multisig", async () => {
    const user = new User();
    user.xpub = mkXpub("xpubA");
    await userRepository.save(user);

    await service.addMultisig(mkXpub("xpubA"), mkAddress("0xa"));
    const msAdded = await userRepository.findByXpub(mkXpub("xpubA"));
    const channel = msAdded!.channels[0];
    expect(channel.multisigAddress).toBe(mkAddress("0xa"));
  });
});
