import { Test, TestingModule } from "@nestjs/testing";

import { DatabaseModule } from "../database/database.module";

import { NodeController } from "./node.controller";
import { NodeModule } from "./node.module";

describe("Node Controller", () => {
  let module: TestingModule;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [],
      imports: [NodeModule, DatabaseModule],
      providers: [],
    }).compile();
  });

  it("should be defined", () => {
    const controller: NodeController= module.get<NodeController>(NodeController);
    expect(controller).toBeDefined();
  });
});
