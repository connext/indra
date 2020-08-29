export interface JSONSerializer<T, U> {
  toJSON(input?: T): U | undefined;
}
