import { Test, TestingModule } from "@nestjs/testing";

import { NodeController } from "./node.controller";

describe("Node Controller", () => {
  let module: TestingModule;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [NodeController],
    }).compile();
  });
  it("should be defined", () => {
    const controller: NodeController = module.get<NodeController>(
      NodeController,
    );
    expect(controller).toBeDefined();
  });
});
