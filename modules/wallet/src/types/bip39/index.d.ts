declare module "bip39" {
  function generateMnemonic(): string
  function mnemonicToSeed(mnemonic: string, password: string): string
  function validateMnemonic(mnemonic: string): boolean

  export = {
    generateMnemonic,
    mnemonicToSeed,
    validateMnemonic
  }
}
