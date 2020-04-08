import { AppRegistry } from "./app";
import { Address, Bytes32, DecString, Transaction, Xpub } from "./basic";
import { IChannelProvider } from "./channelProvider";
import { NodeResponses } from "./node";

export interface INodeApiClient {
  channelProvider: IChannelProvider | undefined;
  userPublicIdentifier: Xpub | undefined;
  nodePublicIdentifier: Xpub | undefined;
  acquireLock(lockName: string, callback: (...args: any[]) => any, timeout: number): Promise<any>;
  appRegistry(
    appDetails?:
      | {
          name: string;
          chainId: number;
        }
      | { appDefinitionAddress: Address },
  ): Promise<AppRegistry>;
  config(): Promise<NodeResponses.GetConfig>;
  createChannel(): Promise<NodeResponses.CreateChannel>;
  clientCheckIn(): Promise<void>;
  getChannel(): Promise<NodeResponses.GetChannel>;
  getLatestSwapRate(from: Address, to: Address): Promise<DecString>;
  getRebalanceProfile(assetId?: Address): Promise<NodeResponses.GetRebalanceProfile>;
  getHashLockTransfer(lockHash: Bytes32): Promise<NodeResponses.GetHashLockTransfer>;
  getPendingAsyncTransfers(): Promise<NodeResponses.GetPendingAsyncTransfers>;
  getTransferHistory(publicIdentifier?: Xpub): Promise<NodeResponses.GetTransferHistory>;
  getLatestWithdrawal(): Promise<Transaction>;
  requestCollateral(assetId: Address): Promise<NodeResponses.RequestCollateral | void>;
  fetchLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetLinkedTransfer>;
  fetchSignedTransfer(paymentId: Bytes32): Promise<NodeResponses.GetSignedTransfer>;
  resolveLinkedTransfer(paymentId: Bytes32): Promise<NodeResponses.ResolveLinkedTransfer>;
  resolveSignedTransfer(paymentId: Bytes32): Promise<NodeResponses.ResolveSignedTransfer>;
  recipientOnline(recipientPublicIdentifier: Xpub): Promise<boolean>;
  restoreState(publicIdentifier: Xpub): Promise<any>;
  subscribeToSwapRates(from: Address, to: Address, callback: any): Promise<void>;
  unsubscribeFromSwapRates(from: Address, to: Address): Promise<void>;
}
