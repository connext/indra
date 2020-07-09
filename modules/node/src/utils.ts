import {
  TransferWithExpiryStatus,
  AppName,
  TransferStatus,
  TransferStatuses,
  TransferWithExpiryStatuses,
  HashLockTransferAppState,
  GenericConditionalTransferAppState,
} from "@connext/types";
import { AppInstance, AppType } from "./appInstance/appInstance.entity";
import { bigNumberifyJson, toBN } from "@connext/utils";

export function appStatusesToTransferStatus<T extends AppName>(
  senderApp: AppInstance<T>,
  receiverApp?: AppInstance<T>,
): TransferStatus | undefined {
  if (!senderApp) {
    return undefined;
  }

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
      const transfers = (receiverApp.latestState as GenericConditionalTransferAppState)
        .coinTransfers;

      // if the transfer in the state has moved from the sender to
      // the receiver of the payment in the receivers app, the
      // payment is complete. otherwise, it failed/was cancelled
      return toBN(transfers[0].amount).isZero()
        ? TransferStatuses.FAILED
        : TransferStatuses.COMPLETED;
    }
    case AppType.INSTANCE: {
      if (!receiverApp) {
        return TransferStatuses.PENDING;
      }
      switch (receiverApp.type) {
        case AppType.PROPOSAL:
        case AppType.INSTANCE: {
          return TransferStatuses.PENDING;
        }
        case AppType.UNINSTALLED: {
          const transfers = (receiverApp.latestState as GenericConditionalTransferAppState)
            .coinTransfers;

          // if the transfer in the state has moved from the sender to
          // the receiver of the payment in the receivers app, the
          // payment is complete. otherwise, it failed/was cancelled
          return toBN(transfers[0].amount).isZero()
            ? TransferStatuses.FAILED
            : TransferStatuses.COMPLETED;
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
