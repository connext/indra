import { AppInterface, AppABIEncodings } from "./app";
import { Address, BigNumber, SolidityValueType, Xpub } from "./basic";
import { OutcomeType } from "./contracts";

////////////////////////////////////////
const install = "install";

type InstallProtocolParams = {
  initiatorXpub: Xpub;
  initiatorDepositTokenAddress: Address;
  responderXpub: Xpub;
  responderDepositTokenAddress: Address;
  multisigAddress: Address;
  initiatorBalanceDecrement: BigNumber;
  responderBalanceDecrement: BigNumber;
  participants: string[];
  initialState: SolidityValueType;
  appInterface: AppInterface;
  defaultTimeout: number;
  appSeqNo: number;
  // Outcome Type returned by the app instance, as defined by `appInterface`
  outcomeType: OutcomeType;
  // By default, the SINGLE_ASSET_TWO_PARTY_COIN_TRANSFER interpreter params
  // contains a "limit" that is computed as
  // `initiatorBalanceDecrement + responderBalanceDecrement`; setting this
  // flag disables the limit by setting it to MAX_UINT256
  disableLimit: boolean;
};

////////////////////////////////////////
const propose = "propose";

type ProposeInstallProtocolParams = {
  multisigAddress: string;
  initiatorXpub: string;
  responderXpub: string;
  appDefinition: string;
  abiEncodings: AppABIEncodings;
  initiatorDeposit: BigNumber;
  initiatorDepositTokenAddress?: string;
  responderDeposit: BigNumber;
  responderDepositTokenAddress?: string;
  timeout: BigNumber;
  initialState: SolidityValueType;
  outcomeType: OutcomeType;
  meta?: Object;
};

////////////////////////////////////////
const setup = "setup";

type SetupProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
};
////////////////////////////////////////
const takeAction = "takeAction";

type TakeActionProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  appIdentityHash: string;
  action: SolidityValueType;
};

////////////////////////////////////////
const uninstall = "uninstall";

type UninstallProtocolParams = {
  appIdentityHash: string;
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  blockNumberToUseIfNecessary?: number;
};

////////////////////////////////////////
const update = "update";

type UpdateProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  appIdentityHash: string;
  newState: SolidityValueType;
};

////////////////////////////////////////
const withdraw = "withdraw";

type WithdrawProtocolParams = {
  initiatorXpub: string;
  responderXpub: string;
  multisigAddress: string;
  recipient: string;
  amount: BigNumber;
  tokenAddress: string;
};

////////////////////////////////////////
// exports

export const ProtocolNames = {
  [install]: install,
  [propose]: propose,
  [setup]: setup,
  [takeAction]: takeAction,
  [uninstall]: uninstall,
  [update]: update,
  [withdraw]: withdraw,
};

export type ProtocolName = keyof typeof ProtocolNames;

export namespace ProtocolParams {
  type install = InstallProtocolParams;
  type propose = ProposeInstallProtocolParams;
  type setup = SetupProtocolParams;
  type takeAction = TakeActionProtocolParams;
  type uninstall = UninstallProtocolParams;
  type update = UpdateProtocolParams;
  type withdraw = WithdrawProtocolParams;
}

export type ProtocolParam =
  | InstallProtocolParams
  | ProposeInstallProtocolParams
  | SetupProtocolParams
  | TakeActionProtocolParams
  | UninstallProtocolParams
  | UpdateProtocolParams
  | WithdrawProtocolParams;
