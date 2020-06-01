import {EntityManager} from 'typeorm';

export type Hook = () => Promise<void>;

export class HookedEntityManager extends EntityManager {
  private acHooks: Hook[] = [];

  async hookedTransaction<T>(
    runInTransaction: (entityManager: HookedEntityManager) => Promise<T>
  ): Promise<T> {
    const res = await super.transaction((em) => runInTransaction(this));
    for (const hook of this.acHooks) {
      await hook();
    }
    return res;
  }

  afterCommit(hook: Hook) {
    this.acHooks.push(hook);
  }

  static fromEM (em: EntityManager) {
    return new HookedEntityManager(em.connection, em.queryRunner);
  }
}