export interface JSONSerializer<T, U> {
  toJSON(input: T): U;
  fromJSON(input: U): T;
}

export interface BigNumberJSON {
  _hex: string;
  _isBigNumber: true;
}
