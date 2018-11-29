const Buffer = require("buffer").Buffer;

module.exports = {
  latestTime: async function latestTime() {
    let t = await web3.eth.getBlock("latest").timestamp;
    return t;
  },

  increaseTimeTo: function increaseTimeTo(target) {
    let now = this.latestTime();
    if (target < now)
      throw Error(
        `Cannot increase current time(${now}) to a moment in the past(${target})`
      );
    let diff = target - now;
    return web3.eth.increaseTime(diff);
  },

  assertThrowsAsync: async function assertThrowsAsync(fn, regExp) {
    let f = () => {};
    try {
      await fn();
    } catch (e) {
      f = () => {
        throw e;
      };
    } finally {
      assert.throws(f, regExp);
    }
  },

  expectThrow: async function expectThrow(promise) {
    try {
      await promise;
    } catch (error) {
      // TODO: Check jump destination to destinguish between a throw
      //       and an actual invalid jump.
      const invalidOpcode = error.message.search("invalid opcode") >= 0;
      // TODO: When we contract A calls contract B, and B throws, instead
      //       of an 'invalid jump', we get an 'out of gas' error. How do
      //       we distinguish this from an actual out of gas event? (The
      //       ganache log actually show an 'invalid jump' event.)
      const outOfGas = error.message.search("out of gas") >= 0;
      const revert = error.message.search("revert") >= 0;
      assert(
        invalidOpcode || outOfGas || revert,
        "Expected throw, got '" + error + "' instead"
      );
      return;
    }
    assert.fail("Expected throw not received");
  },

  duration: {
    seconds: function(val) {
      return val * 1000;
    },
    minutes: function(val) {
      return val * this.seconds(60);
    },
    hours: function(val) {
      return val * this.minutes(60);
    },
    days: function(val) {
      return val * this.hours(24);
    },
    weeks: function(val) {
      return val * this.days(7);
    },
    years: function(val) {
      return val * this.days(365);
    }
  },

  getBytes: function getBytes(input) {
    if (Buffer.isBuffer(input)) input = "0x" + input.toString("hex");
    if (66 - input.length <= 0) return web3.utils.toHex(input);
    return this.padBytes32(web3.utils.toHex(input));
  },

  marshallState: function marshallState(inputs) {
    var m = this.getBytes(inputs[0]);

    for (var i = 1; i < inputs.length; i++) {
      let x = this.getBytes(inputs[i]);
      m += x.substr(2, x.length);
    }
    return m;
  },

  getCTFaddress: async function getCTFaddress(_r) {
    return web3.sha3(_r, { encoding: "hex" });
  },

  getCTFstate: async function getCTFstate(_contract, _signers, _args) {
    _args.unshift(_contract);
    var _m = this.marshallState(_args);
    _signers.push(_contract.length);
    _signers.push(_m);
    var _r = this.marshallState(_signers);
    return _r;
  },

  padBytes32: function padBytes32(data) {
    // TODO: check input is hex / move to TS
    let l = 66 - data.length;

    let x = data.substr(2, data.length);

    for (var i = 0; i < l; i++) {
      x = 0 + x;
    }
    return "0x" + x;
  },

  rightPadBytes32: function rightPadBytes32(data) {
    let l = 66 - data.length;

    for (var i = 0; i < l; i++) {
      data += 0;
    }
    return data;
  },

  hexToBuffer: function hexToBuffer(hexString) {
    return new Buffer(hexString.substr(2, hexString.length), "hex");
  },

  bufferToHex: function bufferToHex(buffer) {
    return "0x" + buffer.toString("hex");
  },

  isHash: function isHash(buffer) {
    return buffer.length === 32 && Buffer.isBuffer(buffer);
  }
};
