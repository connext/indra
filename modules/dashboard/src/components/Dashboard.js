import React from "react";
import Paper from "@material-ui/core/Paper";
import { BrowserRouter as Router, Route } from "react-router-dom";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import { PaymentInfoCardStyled } from "./PaymentInfoCard";
import Home from "./Home";
import classNames from "classnames";
import CssBaseline from "@material-ui/core/CssBaseline";
import Drawer from "@material-ui/core/Drawer";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
//import Badge from "@material-ui/core/Badge";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
//import NotificationsIcon from "@material-ui/icons/Notifications";
import { SidebarLinks } from "./SidebarLinks";
import { DepositsStyled } from "./Deposits";
import { WithdrawalsStyled } from "./Withdrawals";
import { UserInfoStyled } from "./UserInfo";
import { GasCostCardStyled } from "./GasCostCard";
import { CollateralCardStyled } from "./Collateralization";

const drawerWidth = 240;

const styles = theme => ({
  root: {
    display: "flex",
    marginTop: "-10%"
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
  routeWrapper: {
    marginTop: "5%",
    minWidth: "75%"
  },
  title: {
    fontSize: 14
  }
});

class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
      channelManager: this.props.channelManager,
      hubWallet: this.props.hubWallet
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
  };

  render() {
    const { web3, urls, classes } = this.props;
    const {
      open,
      channelManager,
      hubWallet
    } = this.state;

    return (
      <Router>
        <Paper elevation={1}>
          <div className={classes.root}>
            <CssBaseline />
            <AppBar
              position="absolute"
              className={classNames(
                classes.appBar,
                this.state.open && classes.appBarShift
              )}
            >
              <Toolbar
                disableGutters={!this.state.open}
                className={classes.toolbar}
              >
                <IconButton
                  color="inherit"
                  aria-label="Open drawer"
                  onClick={this.handleDrawerOpen}
                  className={classNames(
                    classes.menuButton,
                    this.state.open && classes.menuButtonHidden
                  )}
                >
                  <MenuIcon />
                </IconButton>
                <Typography
                  component="h1"
                  variant="h6"
                  color="inherit"
                  noWrap
                  className={classes.title}
                >
                  DaiCard.io Admin Dashboard
                </Typography>
              </Toolbar>
            </AppBar>
            <Drawer
              variant="permanent"
              classes={{
                paper: classNames(
                  classes.drawerPaper,
                  !this.state.open && classes.drawerPaperClose
                )
              }}
              open={this.state.open}
            >
              <div className={classes.toolbarIcon}>
                <IconButton onClick={this.toggleDrawer}>
                  {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                </IconButton>
              </div>
              <Divider />
              <SidebarLinks urls={urls} />
            </Drawer>
            <div className={classes.routeWrapper}>
              <Route
                exact
                path={`${urls.prefix}/`}
                render={props => (
                  <Home
                    getContractInfo={this.props.getContractInfo}
                    getWalletInfo={this.props.getWalletInfo}
                    hubWallet={hubWallet}
                    channelManager={channelManager}
                    web3={web3}
                    urls={urls}
                  />
                )}
              />
              <Route
                exact
                path={`${urls.prefix}/payments`}
                render={props => (
                  <PaymentInfoCardStyled
                    web3={web3}
                    urls={urls}
                  />
                )}
              />
              <Route
                exact
                path={`${urls.prefix}/deposits`}
                render={props => (
                  <DepositsStyled
                    web3={web3}
                    urls={urls}
                  />
                )}
              />
              <Route
                exact
                path={`${urls.prefix}/withdrawals`}
                render={props => (
                  <WithdrawalsStyled
                    web3={web3}
                    urls={urls}
                  />
                )}
              />
              <Route
                exact
                path={`${urls.prefix}/users`}
                render={props => (
                  <UserInfoStyled
                    web3={web3}
                    urls={urls}
                  />
                )}
              />
              <Route
                exact
                path={`${urls.prefix}/gas`}
                render={props => (
                  <GasCostCardStyled
                    hubWallet={hubWallet}
                    channelManager={channelManager}
                    web3={web3}
                    urls={urls}
                  />
                )}
              />
              <Route
                exact
                path={`${urls.prefix}/collateral`}
                render={props => (
                  <CollateralCardStyled
                    hubWallet={hubWallet}
                    channelManager={channelManager}
                    web3={web3}
                    urls={urls}
                  />
                )}
              />
            </div>
          </div>
        </Paper>
      </Router>
    );
  }
}

Dashboard.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(Dashboard);
