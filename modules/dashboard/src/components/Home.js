import React from "react";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import ChannelDetails from "./ChannelDetails";
import { ContractInfoCardStyled } from "./ContractInfoCard";
import {ChannelInfoCardStyled} from "./ChannelInfoCard";
import { PaymentInfoCardStyled } from "./PaymentInfoCard";
import { GasCostCardStyled } from "./GasCostCard";
import { WithdrawalsStyled } from "./Withdrawals";
import { DepositsStyled } from "./Deposits";
import { UserInfoStyled } from "./UserInfo";
const ChannelManagerAbi = require("../abi/ChannelManager.json");
const TokenAbi = require("../abi/Token.json");

const drawerWidth = 240;

const styles = theme => ({
  root: {
    display: "flex"
  },
  toolbar: {
    paddingRight: 24 // keep right padding when drawer closed
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "0 8px",
    ...theme.mixins.toolbar
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    })
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  menuButton: {
    marginLeft: 12,
    marginRight: 36
  },
  menuButtonHidden: {
    display: "none"
  },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  drawerPaperClose: {
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    }),
    width: theme.spacing.unit * 7,
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing.unit * 9
    }
  },
  appBarSpacer: theme.mixins.toolbar,
  content: {
    flexGrow: 1,
    padding: theme.spacing.unit * 3,
    height: "100vh",
    overflow: "auto"
  },
  chartContainer: {},
  tableContainer: {
    height: 320
  },
  h5: {
    marginBottom: theme.spacing.unit * 2
  },

  title: {
    fontSize: 14
  }
});

class Home extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hubUrl: this.props.hubUrl,
      open: false,
      channelManager: {
        address: '0x',
        wei: {
          raw: 0,
          formatted: 0
        },
        token: {
          raw: 0,
          formatted: 0
        },
      },
      hubWallet: {
        address: '0x',
        wei: {
          raw: 0,
          formatted: 0
        },
        token: {
          raw: 0,
          formatted: 0
        },
      },
      loadingWallet: false,
      loadingContract: false
    };
  }

  async componentDidMount() {
    // await this.getHubConfig();
    // await this.getContractInfo();
    // await this.getWalletInfo(this.state.hubWallet.address);
  }

  async getHubConfig() {
    const config = await (await fetch(`${this.state.hubUrl}/config`)).json();
    console.log(`Got hub config: ${JSON.stringify(config,null,2)}`);
    this.setState(state => {
      state.tokenAddress = config.tokenAddress.toLowerCase()
      state.channelManager.address = config.channelManagerAddress.toLowerCase()
      state.hubWallet.address = config.hubWalletAddress.toLowerCase()
      return state
    });
  }

  getWalletInfo = async (address) => {
    const { web3 } = this.props;
    this.setState({
      loadingWallet: true
    });
    const wei = await web3.eth.getBalance(address)
    console.log("wallet wei: ", wei);
    const tokenContract = new web3.eth.Contract(TokenAbi.abi, this.state.tokenAddress);
    const token = (await tokenContract.methods.balanceOf(address).call())[0]
    console.log("wallet token: ", token)
    this.setState(state => {
      state.hubWallet.wei.raw = wei
      state.hubWallet.wei.formatted = web3.utils.fromWei(wei)
      state.hubWallet.token.raw = token
      state.hubWallet.token.formatted = web3.utils.fromWei(token)
      state.loadingWallet = false
      return state
    });
  }

  getContractInfo = async () => {
    const { web3 } = this.props;
    this.setState({
      loadingContract: true
    });
    console.log("Investigating contract at:", this.state.channelManager.address);
    const cm = new web3.eth.Contract(ChannelManagerAbi.abi, this.state.channelManager.address);
    const wei = await cm.methods.getHubReserveWei().call();
    console.log("contract wei: ", wei);
    const token = await cm.methods.getHubReserveTokens().call()
    console.log("contract token: ", token);
    this.setState(state => {
      state.channelManager.wei.raw = wei
      state.channelManager.wei.formatted = web3.utils.fromWei(wei)
      state.channelManager.token.raw = token
      state.channelManager.token.formatted = web3.utils.fromWei(token)
      state.loadingContract = false
      return state
    });
  };

  handleDrawerOpen = () => {
    this.setState({ open: true });
  };

  handleDrawerClose = () => {
    this.setState({ open: false });
  };

  toggleDrawer = () => {
    this.setState({ open: !this.state.open });
  }

  render() {
    const { classes } = this.props;
    const { loadingWallet, loadingContract, open } = this.state;

    return (
        <main className={classes.content}>
          <Typography variant="h4" gutterBottom component="h2">
            Hub Wallet Reserves
          </Typography>
          <Typography component="div" className={classes.chartContainer} />
          <ContractInfoCardStyled
            wei={this.state.hubWallet.wei}
            token={this.state.hubWallet.token}
            handleRefresh={() => this.getWalletInfo(this.state.hubWallet.address)}
            loading={loadingWallet}
            contractAddress={this.state.hubWallet.address}
          />
          <div className={classes.appBarSpacer} />
          <Typography variant="h4" gutterBottom component="h2">
            Contract Reserves
          </Typography>
          <Typography component="div" className={classes.chartContainer} />
          <ContractInfoCardStyled
            wei={this.state.channelManager.wei}
            token={this.state.channelManager.token}
            handleRefresh={this.getContractInfo}
            loading={loadingContract}
            contractAddress={this.state.channelManager.address}
          />
          <div className={classes.appBarSpacer} />
          <ChannelInfoCardStyled apiUrl={this.props.apiUrl}/>
        </main>
    );
  }
}

Home.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(Home);
