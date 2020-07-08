import {
  TransferWithExpiryStatus,
  AppName,
  TransferStatus,
  TransferStatuses,
  TransferWithExpiryStatuses,
  HashLockTransferAppState,
} from "@connext/types";
import { AppInstance, AppType } from "./appInstance/appInstance.entity";
import { bigNumberifyJson } from "@connext/utils";

export function appStatusesToTransferStatus<T extends AppName>(
  senderApp: AppInstance<T>,
  receiverApp?: AppInstance<T>,
): TransferStatus | undefined {
  switch (senderApp.type) {
    case AppType.PROPOSAL: {
      return TransferStatuses.PENDING;
    }
    case AppType.UNINSTALLED: {
      if (!receiverApp) {
        // Sender app was uninstalled and receiver app rejected
        return TransferStatuses.FAILED;
      }
      if (receiverApp.type !== AppType.UNINSTALLED) {
        // receiver app exists, while sender app has been uninstalled
        return TransferStatuses.FAILED;
      }
      // sender and receiver have uninstalled their apps
      // FIXME: How will you be able to determine if this was a
      // collaborative payment cancellation/failure instead of a
      // success?
      return TransferStatuses.COMPLETED;
    }
    case AppType.INSTANCE: {
      if (!receiverApp) {
        // FIXME: if a receiver app is rejected, we won't be able to retrieve
        // it. how to tell here if app has not yet been installed vs has been
        // rejected?
        return TransferStatuses.PENDING;
      }
      switch (receiverApp.type) {
        case AppType.PROPOSAL:
        case AppType.INSTANCE: {
          return TransferStatuses.PENDING;
        }
        case AppType.UNINSTALLED: {
          // FIXME: How to tell if this was a collaborative payment failure
          // (ie. closing an app before the expiry to revert payment)
          return TransferStatuses.COMPLETED;
        }
        case AppType.FREE_BALANCE:
        default: {
          throw new Error(
            `Cannot determine status, invalid receiver app type: ${receiverApp.type}`,
          );
        }
      }
    }
    case AppType.FREE_BALANCE:
    default: {
      throw new Error(`Cannot determine status, invalid sender app type: ${receiverApp.type}`);
    }
  }
}

export function appStatusesToTransferWithExpiryStatus<T extends AppName>(
  currentBlockNumber: number,
  senderApp: AppInstance<T>,
  receiverApp?: AppInstance<T>,
): TransferWithExpiryStatus | undefined {
  // NOTE: this applies for transfers where the receiver must be online
  if (!receiverApp) {
    return undefined;
  }
  const statusWithoutExpiry = appStatusesToTransferStatus(senderApp, receiverApp);
  // TODO: will transfer statuses always trump expiries?
  if (statusWithoutExpiry !== TransferStatuses.PENDING) {
    return statusWithoutExpiry;
  }
  const receiverState = bigNumberifyJson(
    receiverApp?.latestState || {},
  ) as HashLockTransferAppState;
  const senderState = bigNumberifyJson(senderApp.latestState) as HashLockTransferAppState;
  const isSenderExpired = senderState.expiry && senderState.expiry.lt(currentBlockNumber);
  const isReceiverExpired = receiverState.expiry && receiverState.expiry.lt(currentBlockNumber);
  return isSenderExpired || isReceiverExpired
    ? TransferWithExpiryStatuses.EXPIRED
    : TransferWithExpiryStatuses.PENDING;
}
