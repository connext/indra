import { Controller, Get, Inject } from '@nestjs/common';
import { Node } from '@counterfactual/node';

@Controller('node')
export class NodeController {
  constructor(@Inject('NODE') private readonly node: Node) {}
  @Get()
  find() {
    console.log(this.node);
    console.log('this.node.publicIdentifier: ', this.node.publicIdentifier);
    return this.node.publicIdentifier;
  }
}
