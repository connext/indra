import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';

import {CacheModule} from '../caching/cache.module';
import {AppInstanceRepository} from './appInstance.repository';
import {AppInstanceService} from './appInstance.service';

@Module({
  exports: [AppInstanceService],
  imports: [
    CacheModule,
    TypeOrmModule.forFeature([
      AppInstanceRepository,
    ])
  ],
  providers: [AppInstanceService]
})
export class AppInstanceModule {
}