import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { CacheService } from "./cache.service";
import { LoggerModule } from "../logger/logger.module";

@Module({
  exports: [
    CacheService,
  ],
  imports: [
    RedisModule,
    LoggerModule,
  ],
  providers: [
    CacheService,
  ],
})
export class CacheModule{}
