export interface JSONSerializer<T, U> {
  toJSON(input: T): U;
}

export interface BigNumberJSON {
  _hex: string;
  _isBigNumber: true;
}
