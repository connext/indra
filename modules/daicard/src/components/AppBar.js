import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Grid,
  Button
} from "@material-ui/core";
import { Settings as SettingIcon } from "@material-ui/icons";
import blockies from "ethereum-blockies-png";
import React from "react";
import { Link } from "react-router-dom";

const noAddrBlocky = require("../assets/noAddress.png");

export const AppBarComponent = (props) => (
  <Grid>
    <Grid container spacing={2}>
      <AppBar position="sticky" color="secondary" elevation={0} style={{ paddingTop: "2%"}}>
        <Toolbar>
          <Grid
            container
            spacing={8}
            direction="row"
            justify="space-between"
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
                <img
                  src={
                    props.address
                      ? blockies.createDataURL({ seed: props.address })
                      : noAddrBlocky
                  }
                  alt=""
                  style={{ width: "40px", height: "40px", borderRadius: "4px" }}
                />
                <Typography
                  variant="body2"
                  noWrap
                  style={{
                    width: "75px",
                    color: "#c1c6ce",
                    marginLeft: "0.5em"
                  }}
                >
                  <span>{props.address}</span>
                </Typography>
              </IconButton>
            </Grid>
            <Grid item xs={5}>
              <Button
                disableTouchRipple
                size="small"
                variant="outlined"
                style={{
                  color: "#c1c6ce",
                  borderColor: "#c1c6ce",
                  fontSize: "small"
                }}
                component={Link}
                to="/settings"
              >
                {localStorage.getItem("rpc-prod")}
                <SettingIcon style={{ marginLeft: "3px" }} />
              </Button>
            </Grid>
          </Grid>
        </Toolbar>
      </AppBar>
    </Grid>
  </Grid>
);
