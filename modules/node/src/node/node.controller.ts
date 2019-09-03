import { Node } from "@counterfactual/node";
import { Controller, Get, Inject } from "@nestjs/common";

import { NodeProviderId } from "../constants";

@Controller("node")
export class NodeController {
  constructor(@Inject(NodeProviderId) private readonly node: Node) {}
  @Get()
  find(): any {
    return this.node.publicIdentifier;
  }
}
