# Installing the Client

## Installing

The Connext client package is a javascript interface that wraps contract calls and handles/transmits signed state to and from a Hub.

To install,

```text
$ npm install connext@beta
```

## Async/Await 

Most functions in this package return Promises. The preferred way to consume the package is to use async/await syntax.

```javascript
// React App.js 
async componentDidMount () {
    try {
     const connext = new Connext(this.state.web3)
     await connext.openChannel(Web3.utils.toBN(Web3.utils.toWei(1, 'ether'))) 
     } catch (e) {
        console.log(e)
   }
}  
```

## Instantiating

First import the package into your application's client-side \(frontend\) infrastructure.

```text
const Connext = require("connext");
```

Then, instantiate the package passing in constructor arguments:

```text
const connext = new Connext({
  web3,                        //Instantiated web3 object
  hubAddress,                  //Hub uses account[0] to deploy
  hubUrl,
  contractAddress
});
```



