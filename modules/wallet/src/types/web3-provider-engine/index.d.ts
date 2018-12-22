declare module "web3-provider-engine" {
  namespace Web3ProviderEngine {
    export interface ProviderOpts {
      static?: {
        eth_syncing?: boolean
        web3_clientVersion?: string
      }
      rpcUrl?: string
      getAccounts?: (error: any, accounts?: Array<string>) => void
      approveTransaction?: Function
      signTransaction?: Function
      signMessage?: Function
      processTransaction?: Function
      processMessage?: Function
      processPersonalMessage?: Function
    }
  }

  class Web3ProviderEngine {
    on(event: string, handler: Function): void;
    sendAsync(payload: any, callback: (error: any, response: any) => void): void
  }

  export = Web3ProviderEngine
}

declare module "web3-provider-engine/zero" {
  import Web3ProviderEngine from "web3-provider-engine";

  function ZeroClientProvider(opts: Web3ProviderEngine.ProviderOpts): Web3ProviderEngine

  export = ZeroClientProvider
}
