import { CFCoreTypes, StorePair } from "@connext/types";

export class MemoryStoreService implements CFCoreTypes.IStoreService {
  private readonly store: Map<string, any> = new Map();
  constructor(private readonly delay: number = 0) {}
  async get(path: string): Promise<any> {
    await new Promise((res: any): any => setTimeout(() => res(), this.delay));
    if (path.endsWith("channel") || path.endsWith("appInstanceIdToProposedAppInstance")) {
      const nestedRecords = Array.from(this.store.entries()).filter(entry => {
        return entry[0].includes(path);
      });
      if (nestedRecords.length === 0) {
        return {};
      }

      const results = {};
      nestedRecords.forEach(entry => {
        const key: string = entry[0].split("/").pop()!;
        if (entry[1] !== null) {
          results[key] = entry[1];
        }
      });

      return results;
    }
    if (this.store.has(path)) {
      return this.store.get(path);
    }
    return Promise.resolve(null);
  }

  async set(pairs: { path: string; value: any }[]): Promise<void> {
    await new Promise(res => setTimeout(() => res(), this.delay));
    for (const pair of pairs) {
      this.store.set(
        pair.path,
        pair.value == undefined ? undefined : JSON.parse(JSON.stringify(pair.value)),
      );
    }
  }

  async reset(): Promise<void> {
    await new Promise(res => setTimeout(() => res(), this.delay));
    this.store.clear();
  }

  async restore(): Promise<StorePair[]> {
    return [];
  }
}

export class MemoryStoreServiceFactory implements CFCoreTypes.ServiceFactory {
  constructor(private readonly delay: number = 0) {}
  createStoreService() {
    return new MemoryStoreService(this.delay);
  }
}
