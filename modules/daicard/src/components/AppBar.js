import { AppBar, Toolbar, IconButton, Typography, Grid, Button } from "@material-ui/core";
import { Settings as SettingIcon, Person as ProfileIcon } from "@material-ui/icons";
import blockies from "ethereum-blockies-png";
import React from "react";
import { Link } from "react-router-dom";
import { ChannelCard } from "./channelCard";

const noAddrBlocky = require("../assets/noAddress.png");

export const AppBarComponent = props => (
      <AppBar position="sticky" color="white" elevation={0} style={{ paddingTop: "4%" }}>
        <Toolbar>
          <Grid
            container
            spacing={8}
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            style={{ textAlign: "center" }}
          >
            <Grid item xs={3}>
                <IconButton
                  disableTouchRipple
                  color="inherit"
                  variant="contained"
                  component={Link}
                  to="/deposit"
                >
                  <ProfileIcon fontSize="large" style={{ color: "#002868" }} />
                </IconButton>
            </Grid>
            <Grid item xs={6}>
              <ChannelCard balance={props.balance} swapRate={props.swapRate} />
            </Grid>
            <Grid item xs={3}>
              <Button
                disableTouchRipple
                size="small"
                variant="outlined"
                justify="center"
                alignItems="center"
                style={{
                  color: "#002868",
                  borderColor: "#002868",
                  fontSize: "small",
                }}
                component={Link}
                to="/settings"
              >
                Settings
                <SettingIcon style={{ marginLeft: "3px" }} />
              </Button>
            </Grid>
          </Grid>
        </Toolbar>
      </AppBar>
);
