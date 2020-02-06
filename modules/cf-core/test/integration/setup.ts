import { CF_PATH, CFCoreTypes } from "@connext/types";
import { Wallet } from "ethers";
import {
  JsonRpcProvider,
  Provider,
  TransactionRequest
} from "ethers/providers";
import { parseEther } from "ethers/utils";
import { fromExtendedKey } from "ethers/utils/hdnode";
import { v4 as generateUUID } from "uuid";

import { Node } from "../../src";
import { computeRandomExtendedPrvKey } from "../../src/machine/xkeys";
import MemoryLockService from "../services/memory-lock-service";
import { MemoryMessagingService } from "../services/memory-messaging-service";
import { MemoryStoreServiceFactory } from "../services/memory-store-service";
import {
  A_EXTENDED_PRIVATE_KEY,
  B_EXTENDED_PRIVATE_KEY,
  C_EXTENDED_PRIVATE_KEY
} from "../test-constants.jest";
import { testDomainSeparator } from "./utils";

export interface NodeContext {
  node: Node;
  store: CFCoreTypes.IStoreService;
}

export interface SetupContext {
  [nodeName: string]: NodeContext;
}

export async function setupWithMemoryMessagingAndSlowStore(
  global: any,
  nodeCPresent: boolean = false,
  newExtendedPrvKeys: boolean = false
): Promise<SetupContext> {
  const storeDelay = 2; // milliseconds (tests timeout if too high)
  return setup(
    global,
    nodeCPresent,
    newExtendedPrvKeys,
    new MemoryMessagingService(),
    new MemoryStoreServiceFactory(storeDelay)
  );
}

export async function setup(
  global: any,
  nodeCPresent: boolean = false,
  newExtendedPrvKey: boolean = false,
  messagingService: CFCoreTypes.IMessagingService = new MemoryMessagingService(),
  storeServiceFactory: {
    createStoreService?(storeServiceKey: string): CFCoreTypes.IStoreService;
  } = new MemoryStoreServiceFactory()
): Promise<SetupContext> {
  const setupContext: SetupContext = {};

  const nodeConfig = { STORE_KEY_PREFIX: "test" };

  const provider = new JsonRpcProvider(global["ganacheURL"]);

  const extendedPrvKeyA = A_EXTENDED_PRIVATE_KEY;
  let extendedPrvKeyB = B_EXTENDED_PRIVATE_KEY;

  if (newExtendedPrvKey) {
    const newExtendedPrvKeys = await generateNewFundedExtendedPrvKeys(
      global["fundedPrivateKey"],
      provider
    );
    extendedPrvKeyB = newExtendedPrvKeys.B_EXTENDED_PRV_KEY;
  }

  const lockService = new MemoryLockService();

  const hdNodeA = fromExtendedKey(extendedPrvKeyA).derivePath(CF_PATH);
  const storeServiceA = storeServiceFactory.createStoreService!(
    `test_${generateUUID()}`
  );
  const nodeA = await Node.create(
    messagingService,
    storeServiceA,
    global["networkContext"],
    nodeConfig,
    provider,
    testDomainSeparator,
    lockService,
    hdNodeA.neuter().extendedKey,
    (index: string): Promise<string> =>
      Promise.resolve(hdNodeA.derivePath(index).privateKey)
  );

  setupContext["A"] = {
    node: nodeA,
    store: storeServiceA
  };

  const hdNodeB = fromExtendedKey(extendedPrvKeyB).derivePath(CF_PATH);
  const storeServiceB = storeServiceFactory.createStoreService!(
    `test_${generateUUID()}`
  );
  const nodeB = await Node.create(
    messagingService,
    storeServiceB,
    global["networkContext"],
    nodeConfig,
    provider,
    testDomainSeparator,
    lockService,
    hdNodeB.neuter().extendedKey,
    (index: string): Promise<string> =>
      Promise.resolve(hdNodeB.derivePath(index).privateKey)
  );
  setupContext["B"] = {
    node: nodeB,
    store: storeServiceB
  };

  let nodeC: Node;
  if (nodeCPresent) {
    const hdNodeC = fromExtendedKey(C_EXTENDED_PRIVATE_KEY).derivePath(CF_PATH);
    const storeServiceC = storeServiceFactory.createStoreService!(
      `test_${generateUUID()}`
    );
    nodeC = await Node.create(
      messagingService,
      storeServiceC,
      global["networkContext"],
      nodeConfig,
      provider,
      testDomainSeparator,
      lockService,
      hdNodeC.neuter().extendedKey,
      (index: string): Promise<string> =>
        Promise.resolve(hdNodeC.derivePath(index).privateKey)
    );
    setupContext["C"] = {
      node: nodeC,
      store: storeServiceC
    };
  }

  return setupContext;
}

export async function generateNewFundedWallet(
  fundedPrivateKey: string,
  provider: Provider
) {
  const fundedWallet = new Wallet(fundedPrivateKey, provider);
  const wallet = Wallet.createRandom().connect(provider);

  const transactionToA: TransactionRequest = {
    to: wallet.address,
    value: parseEther("20").toHexString()
  };
  await fundedWallet.sendTransaction(transactionToA);
  return wallet;
}

export async function generateNewFundedExtendedPrvKeys(
  fundedPrivateKey: string,
  provider: Provider
) {
  const fundedWallet = new Wallet(fundedPrivateKey, provider);
  const A_EXTENDED_PRV_KEY = computeRandomExtendedPrvKey();
  const B_EXTENDED_PRV_KEY = computeRandomExtendedPrvKey();

  const signerAPrivateKey = fromExtendedKey(A_EXTENDED_PRV_KEY).derivePath(
    CF_PATH
  ).privateKey;
  const signerBPrivateKey = fromExtendedKey(B_EXTENDED_PRV_KEY).derivePath(
    CF_PATH
  ).privateKey;

  const signerAAddress = new Wallet(signerAPrivateKey).address;
  const signerBAddress = new Wallet(signerBPrivateKey).address;

  const transactionToA: TransactionRequest = {
    to: signerAAddress,
    value: parseEther("1").toHexString()
  };
  const transactionToB: TransactionRequest = {
    to: signerBAddress,
    value: parseEther("1").toHexString()
  };
  await fundedWallet.sendTransaction(transactionToA);
  await fundedWallet.sendTransaction(transactionToB);
  return {
    A_EXTENDED_PRV_KEY,
    B_EXTENDED_PRV_KEY
  };
}
