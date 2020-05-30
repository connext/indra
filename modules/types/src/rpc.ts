export type JsonRpcRequest = {
  id: number;
  jsonrpc: "2.0";
  method: string;
  params: any;
};

export type JsonRpcResponse = {
  id: number;
  jsonrpc: "2.0";
  result: any;
};

export type Rpc = {
  id?: number;
  methodName: string;
  parameters: { [key: string]: any; } | any[];
};
