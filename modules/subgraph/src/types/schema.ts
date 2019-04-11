import {
  TypedMap,
  Entity,
  Value,
  ValueKind,
  store,
  Address,
  Bytes,
  BigInt
} from "@graphprotocol/graph-ts";

export class Channel extends Entity {
  constructor(id: string) {
    this.entries = new Array(0);
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save Channel entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save Channel entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("Channel", id.toString(), this);
  }

  static load(id: string): Channel | null {
    return store.get("Channel", id) as Channel | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get user(): string {
    let value = this.get("user");
    return value.toString();
  }

  set user(value: string) {
    this.set("user", Value.fromString(value));
  }

  get balanceWeiHub(): BigInt {
    let value = this.get("balanceWeiHub");
    return value.toBigInt();
  }

  set balanceWeiHub(value: BigInt) {
    this.set("balanceWeiHub", Value.fromBigInt(value));
  }

  get balanceWeiUser(): BigInt {
    let value = this.get("balanceWeiUser");
    return value.toBigInt();
  }

  set balanceWeiUser(value: BigInt) {
    this.set("balanceWeiUser", Value.fromBigInt(value));
  }

  get balanceTokenHub(): BigInt {
    let value = this.get("balanceTokenHub");
    return value.toBigInt();
  }

  set balanceTokenHub(value: BigInt) {
    this.set("balanceTokenHub", Value.fromBigInt(value));
  }

  get balanceTokenUser(): BigInt {
    let value = this.get("balanceTokenUser");
    return value.toBigInt();
  }

  set balanceTokenUser(value: BigInt) {
    this.set("balanceTokenUser", Value.fromBigInt(value));
  }

  get pendingDepositWeiHub(): BigInt {
    let value = this.get("pendingDepositWeiHub");
    return value.toBigInt();
  }

  set pendingDepositWeiHub(value: BigInt) {
    this.set("pendingDepositWeiHub", Value.fromBigInt(value));
  }

  get pendingDepositWeiUser(): BigInt {
    let value = this.get("pendingDepositWeiUser");
    return value.toBigInt();
  }

  set pendingDepositWeiUser(value: BigInt) {
    this.set("pendingDepositWeiUser", Value.fromBigInt(value));
  }

  get pendingDepositTokenHub(): BigInt {
    let value = this.get("pendingDepositTokenHub");
    return value.toBigInt();
  }

  set pendingDepositTokenHub(value: BigInt) {
    this.set("pendingDepositTokenHub", Value.fromBigInt(value));
  }

  get pendingDepositTokenUser(): BigInt {
    let value = this.get("pendingDepositTokenUser");
    return value.toBigInt();
  }

  set pendingDepositTokenUser(value: BigInt) {
    this.set("pendingDepositTokenUser", Value.fromBigInt(value));
  }

  get pendingWithdrawalWeiHub(): BigInt {
    let value = this.get("pendingWithdrawalWeiHub");
    return value.toBigInt();
  }

  set pendingWithdrawalWeiHub(value: BigInt) {
    this.set("pendingWithdrawalWeiHub", Value.fromBigInt(value));
  }

  get pendingWithdrawalWeiUser(): BigInt {
    let value = this.get("pendingWithdrawalWeiUser");
    return value.toBigInt();
  }

  set pendingWithdrawalWeiUser(value: BigInt) {
    this.set("pendingWithdrawalWeiUser", Value.fromBigInt(value));
  }

  get pendingWithdrawalTokenHub(): BigInt {
    let value = this.get("pendingWithdrawalTokenHub");
    return value.toBigInt();
  }

  set pendingWithdrawalTokenHub(value: BigInt) {
    this.set("pendingWithdrawalTokenHub", Value.fromBigInt(value));
  }

  get pendingWithdrawalTokenUser(): BigInt {
    let value = this.get("pendingWithdrawalTokenUser");
    return value.toBigInt();
  }

  set pendingWithdrawalTokenUser(value: BigInt) {
    this.set("pendingWithdrawalTokenUser", Value.fromBigInt(value));
  }

  get threadRoot(): string {
    let value = this.get("threadRoot");
    return value.toString();
  }

  set threadRoot(value: string) {
    this.set("threadRoot", Value.fromString(value));
  }

  get threadCount(): i32 {
    let value = this.get("threadCount");
    return value.toI32();
  }

  set threadCount(value: i32) {
    this.set("threadCount", Value.fromI32(value));
  }
}
