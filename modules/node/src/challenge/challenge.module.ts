import { Module } from "@nestjs/common";
import { ChallengeService } from "./challenge.service";
import { LoggerModule } from "../logger/logger.module";

@Module({
  exports: [ChallengeService],
  imports: [LoggerModule],
  providers: [ChallengeService],
})
export class ChallengeModule {}
