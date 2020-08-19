export interface JSONSerializer<T, U> {
  toJSON(input?: T): U | undefined;
}

export interface BigNumberJSON {
  _hex: string;
  _isBigNumber: true;
}
