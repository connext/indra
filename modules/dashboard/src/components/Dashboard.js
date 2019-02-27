import React from "react";
import PropTypes from "prop-types";
import classNames from "classnames";
import { withStyles } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import Drawer from "@material-ui/core/Drawer";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import List from "@material-ui/core/List";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import Badge from "@material-ui/core/Badge";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import NotificationsIcon from "@material-ui/icons/Notifications";
import { mainListItems, secondaryListItems } from "./listItems";
import SimpleTable from "./SimpleTable";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
const ChannelManagerAbi = require("../abi/ChannelManager.json");

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
  card: {
    minWidth: 275
  },
  title: {
    fontSize: 14
  },
  pos: {
    marginBottom: 12
  }
});

const ContractInfoCard = props => {
  const { classes, wei, token, loading, handleRefresh, contractAddress } = props;
  return (
    <Card className={classes.card}>
      <CardContent>
        {loading ? (
          <Typography variant="h5" component="h2">
            Loading...
          </Typography>
        ) : (
          <>
            <Typography className={classes.pos} color="textSecondary">
              <a href={`https://rinkeby.etherscan.io/address/${contractAddress}`} target="_blank">{contractAddress}</a>
            </Typography>
            <Typography variant="h5" component="h2">
              {parseFloat(wei.formatted).toFixed(2)}... ETH ({wei.raw} Wei)
            </Typography>
            <Typography variant="h5" component="h2">
              ${parseFloat(token.formatted).toFixed(2)}... DAI ({token.raw} Dei)
            </Typography>
          </>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" onClick={handleRefresh}>
          Refresh
        </Button>
      </CardActions>
    </Card>
  );
};

const ContractInfoCardStyled = withStyles(styles)(ContractInfoCard);

class Dashboard extends React.Component {
  state = {
    open: true,
    wei: {
      raw: 0,
      formatted: 0
    },
    token: {
      raw: 0,
      formatted: 0
    },
    loadingContract: false
  };

  async componentDidMount() {
    await this.getContractInfo();
  }

  getContractInfo = async () => {
    const { web3 } = this.props;
    this.setState({
      loadingContract: true
    });
    console.log("Investigating contract at:", process.env.REACT_APP_CM_ADDRESS);

    const cm = new web3.eth.Contract(ChannelManagerAbi.abi, process.env.REACT_APP_CM_ADDRESS);

    const wei = await cm.methods.getHubReserveWei().call();
    console.log("wei: ", wei);
    const token = await cm.methods.getHubReserveTokens().call();
    console.log("token: ", token);

    this.setState({
      wei: {
        raw: wei,
        formatted: web3.utils.fromWei(wei)
      },
      token: {
        raw: token,
        formatted: web3.utils.fromWei(token)
      },
      loadingContract: false
    });
  };

  handleDrawerOpen = () => {
    this.setState({ open: true });
  };

  handleDrawerClose = () => {
    this.setState({ open: false });
  };

  render() {
    const { classes } = this.props;
    const { wei, token, loadingContract } = this.state;

    return (
      <div className={classes.root}>
        <CssBaseline />
        <AppBar position="absolute" className={classNames(classes.appBar, this.state.open && classes.appBarShift)}>
          <Toolbar disableGutters={!this.state.open} className={classes.toolbar}>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleDrawerOpen}
              className={classNames(classes.menuButton, this.state.open && classes.menuButtonHidden)}
            >
              <MenuIcon />
            </IconButton>
            <Typography component="h1" variant="h6" color="inherit" noWrap className={classes.title}>
              Dashboard
            </Typography>
          </Toolbar>
        </AppBar>
        <Drawer
          variant="permanent"
          classes={{
            paper: classNames(classes.drawerPaper, !this.state.open && classes.drawerPaperClose)
          }}
          open={this.state.open}
        >
          <div className={classes.toolbarIcon}>
            <IconButton onClick={this.handleDrawerClose}>
              <ChevronLeftIcon />
            </IconButton>
          </div>
          <Divider />
          <List>{mainListItems}</List>
          <Divider />
          <List>{secondaryListItems}</List>
        </Drawer>
        <main className={classes.content}>
          <div className={classes.appBarSpacer} />
          <Typography variant="h4" gutterBottom component="h2">
            Contract Reserves
          </Typography>
          <Typography component="div" className={classes.chartContainer} />
          <ContractInfoCardStyled
            wei={wei}
            token={token}
            handleRefresh={this.getContractInfo}
            loading={loadingContract}
            contractAddress={process.env.REACT_APP_CM_ADDRESS}
          />
          <Typography variant="h4" gutterBottom component="h2">
            Channels
          </Typography>
          <div className={classes.tableContainer}>
            <SimpleTable />
          </div>
        </main>
      </div>
    );
  }
}

Dashboard.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(Dashboard);
