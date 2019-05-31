import { Node } from "@counterfactual/node";
import { Controller, Get, Inject } from "@nestjs/common";

import { NodeProviderId } from "../constants";

@Controller("node")
export class NodeController {
  constructor(@Inject(NodeProviderId) private readonly node: Node) {}
  @Get()
  find() {
    console.log(this.node);
    return this.node.publicIdentifier;
  }
}
