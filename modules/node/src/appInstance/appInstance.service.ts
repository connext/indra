import {Injectable} from '@nestjs/common';
import {CacheService} from '../caching/cache.service';
import {
  AppInstanceRepository,
  convertAppToInstanceJSON,
  convertAppToProposedInstanceJSON
} from './appInstance.repository';
import {AppInstance, AppInstanceSerializer, AppType} from './appInstance.entity';
import {AppInstanceJson, AppInstanceProposal} from '@connext/types';
import {HookedEntityManager} from '../database/HookedEntityManager';

@Injectable()
export class AppInstanceService {
  constructor (
    private readonly cache: CacheService,
    private readonly appInstanceRepository: AppInstanceRepository
  ) {
  }

  findByIdentityHash (identityHash: string): Promise<AppInstance | undefined> {
    return this.cache.wrap(`app-instance:${identityHash}`, 60000, () => {
      return this.appInstanceRepository.findByIdentityHash(identityHash);
    }, AppInstanceSerializer);
  }

  async findByIdentityHashOrThrow (identityHash: string): Promise<AppInstance> {
    const app = await this.findByIdentityHash(identityHash);
    if (!app) {
      throw new Error(`Could not find app with identity hash ${identityHash}`);
    }
    return app;
  }

  findFreeBalanceByMultisigAddress (multisigAddress: string): Promise<AppInstance[]> {
    return this.appInstanceRepository.findByMultisigAddressAndType(multisigAddress, AppType.FREE_BALANCE);
  }

  async getAppProposal (appIdentityHash: string): Promise<AppInstanceProposal | undefined> {
    const app = await this.findByIdentityHash(appIdentityHash);
    if (!app || app.type !== AppType.PROPOSAL) {
      return undefined;
    }
    return convertAppToProposedInstanceJSON(app);
  }

  async getFreeBalance (multisigAddress: string): Promise<AppInstanceJson | undefined> {
    const [app] = await this.findFreeBalanceByMultisigAddress(multisigAddress);
    return app && convertAppToInstanceJSON(app, app.channel);
  }

  async getAppInstance (appIdentityHash: string): Promise<AppInstanceJson | undefined> {
    const app = await this.findByIdentityHash(appIdentityHash);
    return app && convertAppToInstanceJSON(app, app.channel);
  }

  async save (tx: HookedEntityManager, app: AppInstance) {
    tx.afterCommit(async () => {
      const json = AppInstanceSerializer.toJSON(app);
      await this.cache.set(`app-instance:${app.identityHash}`, 60000, json);
    });
    await tx.save(app);
  }

  // async updateState (tx: HookedEntityManager, appInstance: AppInstanceUpdateParams) {
  //   tx.afterCommit(async () => {
  //     await this.cache.mergeCacheValues(`app-instance:${appInstance.identityHash}`, 60000, {
  //       latestState: appInstance.latestState as any,
  //       stateTimeout: appInstance.stateTimeout,
  //       latestVersionNumber: appInstance.latestVersionNumber,
  //     });
  //   });
  //   return this.appInstanceRepository.updateState(tx, appInstance);
  // }
}