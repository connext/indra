
export const resolveAddress = async (name, ethProvider) => {
  return await ethProvider.resolveName(name);
}

// TODO: resolve description key from text record
export const resolveXpub = async (name, ethProvider) => {
  return await ethProvider.resolveName(name);
}
