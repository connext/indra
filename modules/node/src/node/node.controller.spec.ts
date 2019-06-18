import { forwardRef } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { ChannelModule } from "../channel/channel.module";
import { ConfigModule } from "../config/config.module";
import { UserModule } from "../user/user.module";

import { NodeController } from "./node.controller";
import { natsProvider, nodeProvider, postgresProvider } from "./node.provider";

describe("Node Controller", () => {
  let module: TestingModule;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [NodeController],
      imports: [ConfigModule, UserModule, forwardRef(() => ChannelModule)],
      providers: [natsProvider, nodeProvider, postgresProvider],
    }).compile();
  });

  it("should be defined", () => {
    const controller: NodeController = module.get<NodeController>(
      NodeController,
    );
    expect(controller).toBeDefined();
  });
});
