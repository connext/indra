const { hexlify, randomBytes } = require("ethers/utils");
const fs = require("fs");

const createRandom32ByteHexString = () => {
  return hexlify(randomBytes(32));
};

const generateLinks = (numberLinks) => {
  if (!numberLinks) {
    throw Error(`Must have a number of links specified`);
  }
  
  console.log(`Generating ${numberLinks} paymentIds and preImages for linked payments.`)

  let obj = {}
  for (let i = 0; i < numberLinks; i++) {
    const paymentId = createRandom32ByteHexString();
    const preImage = createRandom32ByteHexString();
    // indexed with a +1 for bash looping reasons
    obj[i + 1] = { paymentId, preImage }
  }
  fs.writeFileSync("links.json", JSON.stringify(obj, null, 2));
}

generateLinks(process.argv[2]);
