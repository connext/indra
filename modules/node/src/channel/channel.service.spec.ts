import { forwardRef } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { NodeModule } from "../node/node.module";
import { UserModule } from "../user/user.module";

import { ChannelController } from "./channel.controller";
import { ChannelService } from "./channel.service";

describe("ChannelService", () => {
  let service: ChannelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelController],
      imports: [UserModule, forwardRef(() => NodeModule)],
      providers: [ChannelService],
    }).compile();

    service = module.get<ChannelService>(ChannelService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
