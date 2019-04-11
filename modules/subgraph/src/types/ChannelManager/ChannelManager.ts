import {
  EthereumEvent,
  SmartContract,
  EthereumValue,
  JSONValue,
  TypedMap,
  Entity,
  Bytes,
  Address,
  BigInt
} from "@graphprotocol/graph-ts";

export class DidHubContractWithdraw extends EthereumEvent {
  get params(): DidHubContractWithdrawParams {
    return new DidHubContractWithdrawParams(this);
  }
}

export class DidHubContractWithdrawParams {
  _event: DidHubContractWithdraw;

  constructor(event: DidHubContractWithdraw) {
    this._event = event;
  }

  get weiAmount(): BigInt {
    return this._event.parameters[0].value.toBigInt();
  }

  get tokenAmount(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }
}

export class DidUpdateChannel extends EthereumEvent {
  get params(): DidUpdateChannelParams {
    return new DidUpdateChannelParams(this);
  }
}

export class DidUpdateChannelParams {
  _event: DidUpdateChannel;

  constructor(event: DidUpdateChannel) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get senderIdx(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get weiBalances(): Array<BigInt> {
    return this._event.parameters[2].value.toBigIntArray();
  }

  get tokenBalances(): Array<BigInt> {
    return this._event.parameters[3].value.toBigIntArray();
  }

  get pendingWeiUpdates(): Array<BigInt> {
    return this._event.parameters[4].value.toBigIntArray();
  }

  get pendingTokenUpdates(): Array<BigInt> {
    return this._event.parameters[5].value.toBigIntArray();
  }

  get txCount(): Array<BigInt> {
    return this._event.parameters[6].value.toBigIntArray();
  }

  get threadRoot(): Bytes {
    return this._event.parameters[7].value.toBytes();
  }

  get threadCount(): BigInt {
    return this._event.parameters[8].value.toBigInt();
  }
}

export class DidStartExitChannel extends EthereumEvent {
  get params(): DidStartExitChannelParams {
    return new DidStartExitChannelParams(this);
  }
}

export class DidStartExitChannelParams {
  _event: DidStartExitChannel;

  constructor(event: DidStartExitChannel) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get senderIdx(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get weiBalances(): Array<BigInt> {
    return this._event.parameters[2].value.toBigIntArray();
  }

  get tokenBalances(): Array<BigInt> {
    return this._event.parameters[3].value.toBigIntArray();
  }

  get txCount(): Array<BigInt> {
    return this._event.parameters[4].value.toBigIntArray();
  }

  get threadRoot(): Bytes {
    return this._event.parameters[5].value.toBytes();
  }

  get threadCount(): BigInt {
    return this._event.parameters[6].value.toBigInt();
  }
}

export class DidEmptyChannel extends EthereumEvent {
  get params(): DidEmptyChannelParams {
    return new DidEmptyChannelParams(this);
  }
}

export class DidEmptyChannelParams {
  _event: DidEmptyChannel;

  constructor(event: DidEmptyChannel) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get senderIdx(): BigInt {
    return this._event.parameters[1].value.toBigInt();
  }

  get weiBalances(): Array<BigInt> {
    return this._event.parameters[2].value.toBigIntArray();
  }

  get tokenBalances(): Array<BigInt> {
    return this._event.parameters[3].value.toBigIntArray();
  }

  get txCount(): Array<BigInt> {
    return this._event.parameters[4].value.toBigIntArray();
  }

  get threadRoot(): Bytes {
    return this._event.parameters[5].value.toBytes();
  }

  get threadCount(): BigInt {
    return this._event.parameters[6].value.toBigInt();
  }
}

export class DidStartExitThread extends EthereumEvent {
  get params(): DidStartExitThreadParams {
    return new DidStartExitThreadParams(this);
  }
}

export class DidStartExitThreadParams {
  _event: DidStartExitThread;

  constructor(event: DidStartExitThread) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get sender(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get receiver(): Address {
    return this._event.parameters[2].value.toAddress();
  }

  get threadId(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get senderAddress(): Address {
    return this._event.parameters[4].value.toAddress();
  }

  get weiBalances(): Array<BigInt> {
    return this._event.parameters[5].value.toBigIntArray();
  }

  get tokenBalances(): Array<BigInt> {
    return this._event.parameters[6].value.toBigIntArray();
  }

  get txCount(): BigInt {
    return this._event.parameters[7].value.toBigInt();
  }
}

export class DidChallengeThread extends EthereumEvent {
  get params(): DidChallengeThreadParams {
    return new DidChallengeThreadParams(this);
  }
}

export class DidChallengeThreadParams {
  _event: DidChallengeThread;

  constructor(event: DidChallengeThread) {
    this._event = event;
  }

  get sender(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get receiver(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get threadId(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get senderAddress(): Address {
    return this._event.parameters[3].value.toAddress();
  }

  get weiBalances(): Array<BigInt> {
    return this._event.parameters[4].value.toBigIntArray();
  }

  get tokenBalances(): Array<BigInt> {
    return this._event.parameters[5].value.toBigIntArray();
  }

  get txCount(): BigInt {
    return this._event.parameters[6].value.toBigInt();
  }
}

export class DidEmptyThread extends EthereumEvent {
  get params(): DidEmptyThreadParams {
    return new DidEmptyThreadParams(this);
  }
}

export class DidEmptyThreadParams {
  _event: DidEmptyThread;

  constructor(event: DidEmptyThread) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get sender(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get receiver(): Address {
    return this._event.parameters[2].value.toAddress();
  }

  get threadId(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get senderAddress(): Address {
    return this._event.parameters[4].value.toAddress();
  }

  get channelWeiBalances(): Array<BigInt> {
    return this._event.parameters[5].value.toBigIntArray();
  }

  get channelTokenBalances(): Array<BigInt> {
    return this._event.parameters[6].value.toBigIntArray();
  }

  get channelTxCount(): Array<BigInt> {
    return this._event.parameters[7].value.toBigIntArray();
  }

  get channelThreadRoot(): Bytes {
    return this._event.parameters[8].value.toBytes();
  }

  get channelThreadCount(): BigInt {
    return this._event.parameters[9].value.toBigInt();
  }
}

export class DidNukeThreads extends EthereumEvent {
  get params(): DidNukeThreadsParams {
    return new DidNukeThreadsParams(this);
  }
}

export class DidNukeThreadsParams {
  _event: DidNukeThreads;

  constructor(event: DidNukeThreads) {
    this._event = event;
  }

  get user(): Address {
    return this._event.parameters[0].value.toAddress();
  }

  get senderAddress(): Address {
    return this._event.parameters[1].value.toAddress();
  }

  get weiAmount(): BigInt {
    return this._event.parameters[2].value.toBigInt();
  }

  get tokenAmount(): BigInt {
    return this._event.parameters[3].value.toBigInt();
  }

  get channelWeiBalances(): Array<BigInt> {
    return this._event.parameters[4].value.toBigIntArray();
  }

  get channelTokenBalances(): Array<BigInt> {
    return this._event.parameters[5].value.toBigIntArray();
  }

  get channelTxCount(): Array<BigInt> {
    return this._event.parameters[6].value.toBigIntArray();
  }

  get channelThreadRoot(): Bytes {
    return this._event.parameters[7].value.toBytes();
  }

  get channelThreadCount(): BigInt {
    return this._event.parameters[8].value.toBigInt();
  }
}

export class ChannelManager__channelsResult {
  value0: Bytes;
  value1: BigInt;
  value2: Address;
  value3: BigInt;
  value4: i32;

  constructor(
    value0: Bytes,
    value1: BigInt,
    value2: Address,
    value3: BigInt,
    value4: i32
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
    this.value4 = value4;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromFixedBytes(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    map.set("value2", EthereumValue.fromAddress(this.value2));
    map.set("value3", EthereumValue.fromUnsignedBigInt(this.value3));
    map.set("value4", EthereumValue.fromI32(this.value4));
    return map;
  }
}

export class ChannelManager__getChannelBalancesResult {
  value0: BigInt;
  value1: BigInt;
  value2: BigInt;
  value3: BigInt;
  value4: BigInt;
  value5: BigInt;

  constructor(
    value0: BigInt,
    value1: BigInt,
    value2: BigInt,
    value3: BigInt,
    value4: BigInt,
    value5: BigInt
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
    this.value4 = value4;
    this.value5 = value5;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromUnsignedBigInt(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    map.set("value2", EthereumValue.fromUnsignedBigInt(this.value2));
    map.set("value3", EthereumValue.fromUnsignedBigInt(this.value3));
    map.set("value4", EthereumValue.fromUnsignedBigInt(this.value4));
    map.set("value5", EthereumValue.fromUnsignedBigInt(this.value5));
    return map;
  }
}

export class ChannelManager__getChannelDetailsResult {
  value0: BigInt;
  value1: BigInt;
  value2: Bytes;
  value3: BigInt;
  value4: Address;
  value5: BigInt;
  value6: i32;

  constructor(
    value0: BigInt,
    value1: BigInt,
    value2: Bytes,
    value3: BigInt,
    value4: Address,
    value5: BigInt,
    value6: i32
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
    this.value4 = value4;
    this.value5 = value5;
    this.value6 = value6;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromUnsignedBigInt(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    map.set("value2", EthereumValue.fromFixedBytes(this.value2));
    map.set("value3", EthereumValue.fromUnsignedBigInt(this.value3));
    map.set("value4", EthereumValue.fromAddress(this.value4));
    map.set("value5", EthereumValue.fromUnsignedBigInt(this.value5));
    map.set("value6", EthereumValue.fromI32(this.value6));
    return map;
  }
}

export class ChannelManager__getThreadResult {
  value0: BigInt;
  value1: BigInt;
  value2: BigInt;
  value3: BigInt;
  value4: BigInt;
  value5: BigInt;
  value6: boolean;
  value7: boolean;

  constructor(
    value0: BigInt,
    value1: BigInt,
    value2: BigInt,
    value3: BigInt,
    value4: BigInt,
    value5: BigInt,
    value6: boolean,
    value7: boolean
  ) {
    this.value0 = value0;
    this.value1 = value1;
    this.value2 = value2;
    this.value3 = value3;
    this.value4 = value4;
    this.value5 = value5;
    this.value6 = value6;
    this.value7 = value7;
  }

  toMap(): TypedMap<string, EthereumValue> {
    let map = new TypedMap<string, EthereumValue>();
    map.set("value0", EthereumValue.fromUnsignedBigInt(this.value0));
    map.set("value1", EthereumValue.fromUnsignedBigInt(this.value1));
    map.set("value2", EthereumValue.fromUnsignedBigInt(this.value2));
    map.set("value3", EthereumValue.fromUnsignedBigInt(this.value3));
    map.set("value4", EthereumValue.fromUnsignedBigInt(this.value4));
    map.set("value5", EthereumValue.fromUnsignedBigInt(this.value5));
    map.set("value6", EthereumValue.fromBoolean(this.value6));
    map.set("value7", EthereumValue.fromBoolean(this.value7));
    return map;
  }
}

export class ChannelManager extends SmartContract {
  static bind(address: Address): ChannelManager {
    return new ChannelManager("ChannelManager", address);
  }

  totalChannelWei(): BigInt {
    let result = super.call("totalChannelWei", []);
    return result[0].toBigInt();
  }

  totalChannelToken(): BigInt {
    let result = super.call("totalChannelToken", []);
    return result[0].toBigInt();
  }

  hub(): Address {
    let result = super.call("hub", []);
    return result[0].toAddress();
  }

  channels(param0: Address): ChannelManager__channelsResult {
    let result = super.call("channels", [EthereumValue.fromAddress(param0)]);
    return new ChannelManager__channelsResult(
      result[0].toBytes(),
      result[1].toBigInt(),
      result[2].toAddress(),
      result[3].toBigInt(),
      result[4].toI32()
    );
  }

  NAME(): string {
    let result = super.call("NAME", []);
    return result[0].toString();
  }

  approvedToken(): Address {
    let result = super.call("approvedToken", []);
    return result[0].toAddress();
  }

  challengePeriod(): BigInt {
    let result = super.call("challengePeriod", []);
    return result[0].toBigInt();
  }

  VERSION(): string {
    let result = super.call("VERSION", []);
    return result[0].toString();
  }

  getHubReserveWei(): BigInt {
    let result = super.call("getHubReserveWei", []);
    return result[0].toBigInt();
  }

  getHubReserveTokens(): BigInt {
    let result = super.call("getHubReserveTokens", []);
    return result[0].toBigInt();
  }

  getChannelBalances(user: Address): ChannelManager__getChannelBalancesResult {
    let result = super.call("getChannelBalances", [
      EthereumValue.fromAddress(user)
    ]);
    return new ChannelManager__getChannelBalancesResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBigInt(),
      result[3].toBigInt(),
      result[4].toBigInt(),
      result[5].toBigInt()
    );
  }

  getChannelDetails(user: Address): ChannelManager__getChannelDetailsResult {
    let result = super.call("getChannelDetails", [
      EthereumValue.fromAddress(user)
    ]);
    return new ChannelManager__getChannelDetailsResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBytes(),
      result[3].toBigInt(),
      result[4].toAddress(),
      result[5].toBigInt(),
      result[6].toI32()
    );
  }

  getThread(
    sender: Address,
    receiver: Address,
    threadId: BigInt
  ): ChannelManager__getThreadResult {
    let result = super.call("getThread", [
      EthereumValue.fromAddress(sender),
      EthereumValue.fromAddress(receiver),
      EthereumValue.fromUnsignedBigInt(threadId)
    ]);
    return new ChannelManager__getThreadResult(
      result[0].toBigInt(),
      result[1].toBigInt(),
      result[2].toBigInt(),
      result[3].toBigInt(),
      result[4].toBigInt(),
      result[5].toBigInt(),
      result[6].toBoolean(),
      result[7].toBoolean()
    );
  }
}
