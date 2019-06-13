import { forwardRef } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { NodeModule } from "../node/node.module";
import { UserModule } from "../user/user.module";

import { ChannelController } from "./channel.controller";
import { ChannelService } from "./channel.service";

describe("Channel Controller", () => {
  let controller: ChannelController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelController],
      imports: [UserModule, forwardRef(() => NodeModule)],
      providers: [ChannelService],
    }).compile();

    controller = module.get<ChannelController>(ChannelController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
