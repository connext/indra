import { IMessagingService } from "@connext/messaging";
import { Node } from "@counterfactual/types";
import { v4 as uuidV4 } from "uuid";

const log = (msg: string): void => console.log(`[ProxyLockService] ${msg}`);
// const warn = (msg: string): void => console.warn(`[ProxyLockService WARNING] ${msg}`);
const error = (msg: string): void => console.error(`[ProxyLockService ERROR] ${msg}`);

export class ProxyLockService implements Node.ILockService {
  constructor(private readonly messaging: IMessagingService) {}

  async acquireLock(
    lockName: string,
    callback: (...args: any[]) => any,
    timeout: number,
  ): Promise<any> {
    const lockValue = await this.send(`lock.acquire.${lockName}`, { lockTTL: timeout });
    log(`Acquired lock at ${Date.now()} for ${lockName} with secret ${lockValue}`);

    let retVal: any;
    try {
      retVal = await callback();
    } catch (e) {
      error("Failed to execute callback while lock is held");
      error(e);
    } finally {
      await this.send(`lock.release.${lockName}`, {
        lockValue,
      });
      log(`Released lock at ${Date.now()} for ${lockName}`);
    }

    return retVal;
  }

  private async send(subject: string, data?: any): Promise<any | undefined> {
    const msg = await this.messaging.request(subject, 30_000, {
      ...data,
      id: uuidV4(),
    });
    if (!msg.data) {
      log(`Maybe this message is malformed: ${JSON.stringify(msg, null, 2)}`);
      return undefined;
    }
    const { err, response } = msg.data;
    const responseErr = response && response.err;
    if (err || responseErr) {
      throw new Error(`Error sending request. Message: ${JSON.stringify(msg, null, 2)}`);
    }
    const isEmptyObj = typeof response === "object" && Object.keys(response).length === 0;
    return !response || isEmptyObj ? undefined : response;
  }
}
