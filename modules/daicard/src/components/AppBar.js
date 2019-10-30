import {
  AppBar,
  IconButton,
  Grid,
  withStyles,
} from "@material-ui/core";
import {
  Settings as SettingIcon,
  Person as ProfileIcon,
  ArrowForward,
  Home,
} from "@material-ui/icons";
import React from "react";
import { Link } from "react-router-dom";
import ChannelCard from "./channelCard";
import PropTypes from "prop-types";

const styles = {
  top: {
    paddingTop: "4%",
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    "z-index": "auto"
  },
  containerTop: {
    textAlign: "center",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  icon: {
    color: "#002868",
  },
  button: {
    color: "#002868",
    borderColor: "#002868",
    fontSize: "small",
  },
  buttonHidden: {
    display: "none",
  },
};

const AppBarComponent = props => {
  const { classes } = props;
  const currentRoute = window.location.pathname;
  return (
    <AppBar position="sticky" color="inherit" elevation={0} className={classes.top}>
      <Grid container className={classes.containerTop}>
        <Grid item xs={3}>
          <IconButton
            id="goToHomeButton"
            className={classes.button}
            disableTouchRipple
            color="inherit"
            variant="contained"
            component={Link}
            to="/"
          >
            <Home className={classes.icon} />
          </IconButton>
        </Grid>
        <Grid item xs={6}>
          <ChannelCard network={props.network} balance={props.balance} swapRate={props.swapRate} />
        </Grid>
        <Grid item xs={3}>
          <IconButton
            id="goToSettingsButton"
            className={classes.button}
            disableTouchRipple
            color="inherit"
            variant="contained"
            component={Link}
            to="/settings"
          >
            <SettingIcon className={classes.icon} />
          </IconButton>
        </Grid>
      </Grid>
    </AppBar>
  );
};

AppBarComponent.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(AppBarComponent);
