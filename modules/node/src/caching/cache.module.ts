import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { CacheService } from "./cache.service";

@Module({
  exports: [
    CacheService,
  ],
  imports: [
    RedisModule,
  ],
  providers: [
    CacheService,
  ],
})
export class CacheModule{}
