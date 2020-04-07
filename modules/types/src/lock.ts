// Centralized locking service (i.e. redis)
export interface ILockService {
  acquireLock(
    lockName: string /* Bytes32? */,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any>;
}
