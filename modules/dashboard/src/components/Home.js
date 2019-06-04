import React from "react";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import { ContractInfoCardStyled } from "./ContractInfoCard";
import { ChannelInfoCardStyled } from "./ChannelInfoCard";

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
      hubWallet: this.props.hubWallet,
      channelManager: this.props.channelManager,
      open: false,
      loadingWallet: false,
      loadingContract: false
    };
  }


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
    const { loadingWallet, loadingContract, hubWallet, channelManager} = this.state;

    return (
        <main className={classes.content}>
          <Typography variant="h4" gutterBottom component="h2">
            Hub Wallet Reserves
          </Typography>
          <Typography component="div" className={classes.chartContainer} />
          <ContractInfoCardStyled
            wei={hubWallet.wei}
            token={hubWallet.token}
            handleRefresh={() => this.props.getWalletInfo(hubWallet.address)}
            loading={loadingWallet}
            contractAddress={hubWallet.address}
          />
          <div className={classes.appBarSpacer} />
          <Typography variant="h4" gutterBottom component="h2">
            Contract Reserves
          </Typography>
          <Typography component="div" className={classes.chartContainer} />
          <ContractInfoCardStyled
            wei={channelManager.wei}
            token={channelManager.token}
            handleRefresh={this.props.getContractInfo}
            loading={loadingContract}
            contractAddress={channelManager.address}
          />
          <div className={classes.appBarSpacer} />
          <ChannelInfoCardStyled urls={this.props.urls}/>
        </main>
    );
  }
}

Home.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(Home);
