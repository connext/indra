import React from "react";
import { Button, Grid, Typography, styled } from "@material-ui/core";
import { Switch, Route, Link } from "react-router-dom";
import PropTypes from "prop-types";
import DebugChannel from "./DebugChannel";
import DebugNode from "./DebugNode";
import Admin from "./Admin/Admin";
import { Home as HomeIcon } from "@material-ui/icons";

const TopGrid = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  flexDirection: "row",
  width: "100%",
  height: "100%",
});

const AppBar = styled(Grid)({
  width: "100%",
  paddingTop: "15px",
});

const AppBarButton = styled(Button)({
  display: "flex",
  height: "45px",
  alignItems: "center",
  justifyContent: "center",
  margin: "0% 1% 0% 1%",
  paddingLeft: "1%",
  paddingRight: "1%",

  // border: "3px solid #002868",
  textDecoration: "none",
  "&:hover": { backgroundColor: "rgba(0,40,104,0.2)" },
});

const AppBarButtonTypography = styled(Typography)({
  textAlign: "center",
  fontSize: "24px",
  color: "#002868",
  textDecoration: "none",
  paddingLeft: "2%",
  paddingRight: "2%",
});

function Debug({ classes, messaging, prefix }) {
  return (
    <TopGrid container>
      <AppBar container>
        <AppBarButton component={Link} to={`${prefix}`}>
          <HomeIcon />
        </AppBarButton>
        <AppBarButton component={Link} to={`${prefix}/debug/channel`}>
          <AppBarButtonTypography>Channels</AppBarButtonTypography>
        </AppBarButton>
        <AppBarButton component={Link} to={`${prefix}/debug/node`}>
          <AppBarButtonTypography>Node</AppBarButtonTypography>
        </AppBarButton>
        <AppBarButton component={Link} to={`${prefix}/debug/admin`}>
          <AppBarButtonTypography>Admin</AppBarButtonTypography>
        </AppBarButton>
      </AppBar>
      <Switch>
        <Route
          exact
          path={`${prefix}/debug/channel`}
          render={props => <DebugChannel {...props} messaging={messaging} />}
        />
        <Route
          exact
          path={`${prefix}/debug/node`}
          render={props => <DebugNode {...props} messaging={messaging} />}
        />
        <Route
          exact
          path={`${prefix}/debug/admin`}
          render={props => <Admin {...props} messaging={messaging} />}
        />
      </Switch>
    </TopGrid>
  );
}

export default Debug;
