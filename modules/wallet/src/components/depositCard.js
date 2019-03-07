import React, { Component } from "react";
import Card from "@material-ui/core/Card";
import Button from "@material-ui/core/Button";
import ArchiveIcon from "@material-ui/icons/Archive";
import TextField from "@material-ui/core/TextField";
import Switch from "@material-ui/core/Switch";
//import HelpIcon from "@material-ui/icons/Help";
//import IconButton from "@material-ui/core/IconButton";
//import Popover from "@material-ui/core/Popover";
//import Typography from "@material-ui/core/Typography";
import { store } from "../App.js";
const Web3 = require("web3");
const eth = require("ethers");

const BALANCE_THRESHOLD_WEI = Web3.utils.toBN(Web3.utils.toWei("40", "finney"));

class DepositCard extends Component {
  state = {
    checkedA: true,
    checkedB: false,
    anchorEl: null,
    depositVal: {
      amountWei: "0",
      amountToken: "0"
    },
    displayVal: "0",
    error: null
  };

  handleClick = event => {
    console.log("click handled");
    this.setState({
      anchorEl: event.currentTarget
    });
  };

  handleClose = () => {
    this.setState({
      anchorEl: null
    });
  };

  handleChange = name => event => {
    var depositValWei = this.state.depositVal.amountWei;
    var depositValToken = this.state.depositVal.amountToken;
    this.setState({ [name]: event.target.checked });
    if (this.state.checkedB) {
      this.setState({ displayVal: depositValWei });
    } else {
      this.setState({ displayVal: depositValToken });
    }
  };

  async updateDepositHandler(evt) {
    var value = evt.target.value;
    this.setState({
      displayVal: evt.target.value
    });
    if (!this.state.checkedB) {
      await this.setState(oldState => {
        oldState.depositVal.amountWei = value;
        oldState.depositVal.amountToken = "0"
        return oldState;
      });
    } else if (this.state.checkedB) {
      await this.setState(oldState => {
        oldState.depositVal.amountToken = value;
        oldState.depositVal.amountWei = "0"
        return oldState;
      });
    }
    console.log(
      `Updated depositVal: ${JSON.stringify(this.state.depositVal, null, 2)}`
    );
  }

  // deposit handler should simply get amounts from metamask and let the balance poller deposit into the channel
  async depositHandler() {
    try {
      const { usingMetamask, connext/*, metamask*/, connextState } = this.props
      if (!connextState || !connextState.runtime.canDeposit) {
        console.warn('Cannot deposit into channel')
        return
      }
      const wei = this.state.depositVal.amountWei;
      const tokens = this.state.depositVal.amountToken;
      console.log(`wei: ${wei}`);
      console.log(`tokens: ${tokens}`);

      this.setState({error: null})
      // if you are using metamask, deposit directly with connext
      // otherwise, fetch tokens/eth
      console.log('usingMetamask:', usingMetamask)
      if (usingMetamask) {
        await connext.deposit({ amountWei: wei, amountToken: tokens, recipient: "user" })
      } else {
        if (wei !== "0") {
          console.log("found wei deposit");
          // if (wei <= (metamask.balance * 1000000000000000000)) {
            await this.getEther(wei);
        //   } else {
        //     throw new Error("Insufficient ETH balance in MetaMask")
        //   }
        }
  
        if (tokens !== "0") {
          console.log("found token deposit");
          // if (tokens <= (metamask.tokenBalance * 1000000000000000000)) {
            await this.getTokens(tokens);
          // } else {
          //   throw new Error("Insufficient TST balance in MetaMask")
          // }
        }
      }

    } catch (e) {
      console.log(`error fetching deposit from metamask: ${e}`);
      this.setState({error: e.message})
    }
  }

  async getTokens(amountToken) {
    const { tokenContract, tokenAbi, } = this.props
    console.log('tokenContract:', tokenContract)
    let web3 = window.web3;
    console.log(web3);
    if (!web3) {
      alert("You need to install & unlock metamask to do that [3]");
      return;
    }
    const metamaskProvider = new Web3(web3.currentProvider);
    const mmAddr = (await metamaskProvider.eth.getAccounts())[0];
    const browserAddr = store.getState()[0].getAddressString()
    if (!mmAddr) {
      alert("You need to install & unlock metamask to do that [4]");
      return;
    }

    const tc = new metamaskProvider.eth.Contract(
      tokenAbi,
      tokenContract._address
    );

    console.log(
      `Sending ${amountToken} tokens from ${mmAddr} to ${browserAddr}`
    );

    console.log("state:");
    console.log(this.state);

    const transferTx = await tc.methods
    .transfer(browserAddr, amountToken)
    .send({
      from: mmAddr,
      gas: "81000"
    });
    console.log('Token transfer tx:', transferTx);

    // get balance of wallet addr
    // if there is less than 40fin, deposit for gas allowance
    const browserWei = metamaskProvider.utils.toBN(await metamaskProvider.eth.getBalance(browserAddr))
    if (browserWei.lt(BALANCE_THRESHOLD_WEI)) {
      try {
        // safe to use getEther, since if you are using metamask,
        // the condition in the if statement should be false
        // since you are using a default acct with 100 ETH
        await this.getEther("0")
      } catch (e) {
        console.log(
          `Eth sent to: ${store.getState()[0].getAddressString()}.`
        );
      }
    }
  }

  // to get wei from metamask to browser wallet
  async getEther(amountWei) {
    const { usingMetamask, channelManagerAddress, connext } = this.props
    let web3 = window.web3;
    console.log('window.web3', web3);
    if (!web3) {
      alert("You need to install & unlock metamask to do that [1]");
      return;
    }
    const metamaskProvider = new eth.providers.Web3Provider(
      web3.currentProvider
    );
    const mmAddr = (await metamaskProvider.listAccounts())[0];
    const browserAddr = store.getState()[0].getAddressString()
    if (!mmAddr) {
      alert("You need to install & unlock metamask to do that [2]");
      return;
    }

    // if the autosigner is being used, send to that address
    // otherwise, send from metamask to contract
    try {
      if (usingMetamask) {
        console.log(`Sending ${amountWei} wei from ${mmAddr} to channel`)
        const sentTx = await connext.deposit({ amountWei: amountWei , amountToken: "0", recipient: "user"  })
        console.log(
          `Eth sent to: ${channelManagerAddress}. Tx: `,
          sentTx
        );
      } else {
        // make sure that this brings browser wallet balance up to
        // 40fin for gas costs
        let weiDeposit
        const browserWei = Web3.utils.toBN(
          await metamaskProvider.getBalance(browserAddr)
        )
        const amountWeiBN = Web3.utils.toBN(amountWei)
        // deposit + existing bal should be above threshold
        if (browserWei.add(amountWeiBN).lt(BALANCE_THRESHOLD_WEI)) {
          console.log(`Browser wallet balance + requested deposit below minimum, adding enough to bring total to 40fin.`)
          weiDeposit = BALANCE_THRESHOLD_WEI.sub(browserWei)
        }

        console.log(`Sending ${weiDeposit ? weiDeposit.toString() : amountWei} wei from ${mmAddr} to ${browserAddr}`)

        const metamask = metamaskProvider.getSigner();
        const sentTx = await metamask.sendTransaction({
          to: browserAddr,
          value: weiDeposit 
            ? eth.utils.bigNumberify(weiDeposit.toString()) 
            : eth.utils.bigNumberify(amountWei),
          gasLimit: eth.utils.bigNumberify("21000"),
        })

        console.log(
          `Eth sent to: ${store.getState()[0].getAddressString()}. Tx: `,
          sentTx
        );
      }
    } catch (e) {
      console.warn(`Error sending transaction: ${e.message}`)
    }
  }

  render() {
    //const { anchorEl } = this.state;
    const { connextState } = this.props
    //const open = Boolean(anchorEl);
    const cardStyle = {
      card: {
        display: "flex",
        flexWrap: "wrap",
        flexBasis: "100%",
        flexDirection: "row",
        width: "230px",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        padding: "4% 4% 4% 4%"
      },
      icon: {
        width: "50px",
        height: "50px",
        paddingTop: "8px"
      },
      input: {
        width: "100%"
      },
      button: {
        width: "100%",
        height: "40px",
        backgroundColor: "#FCA311",
        color: "#FFF"
      },
      col1: {
        marginLeft: "55px",
        width: "40%",
        justifyContent: "'flex-end' !important"
      },
      col2: {
        width: "3%",
        justifyContent: "'flex-end' !important"
      },
      popover: {
        padding: "8px 8px 8px 8px"
      }
    };

    return (
      <Card style={cardStyle.card}>
        <div style={cardStyle.col1}>
          <ArchiveIcon style={cardStyle.icon} />
        </div>

        <div>
          ETH
          <Switch
            checked={this.state.checkedB}
            onChange={this.handleChange("checkedB")}
            value="checkedB"
            color="primary"
          />
          TST
        </div>
        <TextField
          style={cardStyle.input}
          id="outlined-number"
          label="Amount (Wei)"
          value={this.state.displayVal}
          type="number"
          margin="normal"
          variant="outlined"
          onChange={evt => this.updateDepositHandler(evt)}
          error={this.state.error != null}
          helperText={this.state.error}
        />
        <Button
          style={cardStyle.button}
          variant="contained"
          onClick={evt => this.depositHandler(evt)}
          disabled={!connextState || !connextState.runtime.canDeposit}
        >
          Deposit
        </Button>
      </Card>
    );
  }
}

export default DepositCard;
