const { hexlify, randomBytes } = require("ethers/utils");
const fs = require("fs");

(function (numberLinks, linksFile) {
  if (!numberLinks) throw Error(`Must have a number of links specified`);
  console.log(`Generating ${numberLinks} paymentIds and preImages for linked payments.`)
  let obj = {}
  for (let i = 1; i <= numberLinks; i++) {
    obj[i] = { paymentId: hexlify(randomBytes(32)), preImage: hexlify(randomBytes(32)) }
  }
  fs.writeFileSync(linksFile, JSON.stringify(obj, null, 2));
})(process.argv[2], process.argv[3])
