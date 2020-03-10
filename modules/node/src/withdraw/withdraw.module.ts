import { Module, HttpModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { AuthModule } from "../auth/auth.module";
import { CFCoreModule } from "../cfCore/cfCore.module";
import { ConfigModule } from "../config/config.module";
import { LoggerModule } from "../logger/logger.module";
import { MessagingModule } from "../messaging/messaging.module";
import { OnchainTransactionModule } from "../onchainTransactions/onchainTransaction.module";
import { OnchainTransactionRepository } from "../onchainTransactions/onchainTransaction.repository";
import { RebalanceProfileRepository } from "../rebalanceProfile/rebalanceProfile.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelModule } from "../channel/channel.module";

// import { channelProviderFactory } from "./withdraw.provider";
// import { WithdrawRepository } from "./withdraw.repository";
import { WithdrawService } from "./withdraw.service";

@Module({
    controllers: [],
    exports: [WithdrawService],
    imports: [
        AuthModule,
        CFCoreModule,
        ChannelModule,
        ConfigModule,
        LoggerModule,
        MessagingModule,
        TypeOrmModule.forFeature([
        ChannelRepository,
        AppRegistryRepository,
        // LinkedTransferRepository,
        // FastSignedTransferRepository,
        // TransferRepository,
        // WithdrawRepository
        ]),
    ],
    providers: [WithdrawService],
})
export class WithdrawModule {}
