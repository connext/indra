import { Module } from '@nestjs/common';
import { NodeController } from './node.controller';
import { NodeProvider } from './node.provider';
import { ConfigModule } from '../config/config.module';

@Module({
  providers: [NodeProvider],
  imports: [ConfigModule],
  controllers: [NodeController],
  exports: [NodeProvider],
})
export class NodeModule {}
