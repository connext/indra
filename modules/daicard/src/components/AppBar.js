import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Grid,
  Button,
  withStyles,
} from "@material-ui/core";
import { Settings as SettingIcon, Person as ProfileIcon } from "@material-ui/icons";
import blockies from "ethereum-blockies-png";
import React from "react";
import { Link } from "react-router-dom";
import ChannelCard from "./channelCard";
import PropTypes from "prop-types";

const noAddrBlocky = require("../assets/noAddress.png");

const styles = {
  top: {
    paddingTop: "4%",
  },
  containerTop: {
    textAlign: "center",
  },
  icon: {
    color: "#002868",
  },
  button: {
    color: "#002868",
    borderColor: "#002868",
    fontSize: "small",
  },
};

const AppBarComponent = props => {
  const { classes } = props;
  return (
    <AppBar position="sticky" color="white" elevation={0} className={classes.top}>
      <Toolbar>
        <Grid
          container
          spacing={8}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          className={classes.containerTop}
        >
          <Grid item xs={3}>
            <IconButton
              disableTouchRipple
              color="inherit"
              variant="contained"
              component={Link}
              to="/deposit"
            >
              <ProfileIcon fontSize="large" className={classes.icon} />
            </IconButton>
          </Grid>
          <Grid item xs={6}>
            <ChannelCard balance={props.balance} swapRate={props.swapRate} />
          </Grid>
          <Grid item xs={3}>
            <Button
              className={classes.button}
              disableTouchRipple
              size="small"
              variant="outlined"
              justify="center"
              alignItems="center"
              component={Link}
              to="/settings"
            >
              <SettingIcon className={classes.icon} />
            </Button>
          </Grid>
        </Grid>
      </Toolbar>
    </AppBar>
  );
};

AppBarComponent.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(AppBarComponent);
