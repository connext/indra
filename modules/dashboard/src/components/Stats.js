import React from "react";
import { Button, Grid, Typography, styled } from "@material-ui/core";
import { Home as HomeIcon } from "@material-ui/icons";

import { Switch, Route, Link } from "react-router-dom";
import StatsSummary from "./StatsSummary";
import StatsGas from "./StatsGas";
import StatsTransfers from "./StatsTransfers";
import StatsExport from "./StatsExport";

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

function Stats({ classes, messaging, prefix }) {
  return (
    <TopGrid container>
      <AppBar container>
        <AppBarButton component={Link} to={`${prefix}`}>
          <HomeIcon color="primary" />{" "}
        </AppBarButton>
        <AppBarButton component={Link} to={`${prefix}/stats/summary`}>
          <AppBarButtonTypography>Summary</AppBarButtonTypography>
        </AppBarButton>
        <AppBarButton component={Link} to={`${prefix}/stats/transfers`}>
          <AppBarButtonTypography>Transfers</AppBarButtonTypography>
        </AppBarButton>

        <AppBarButton component={Link} to={`${prefix}/stats/gas`}>
          <AppBarButtonTypography>Gas</AppBarButtonTypography>
        </AppBarButton>

        <AppBarButton component={Link} to={`${prefix}/stats/export`}>
          <AppBarButtonTypography>Export</AppBarButtonTypography>
        </AppBarButton>
      </AppBar>
      <Switch>
        <Route
          exact
          path={`${prefix}/stats/summary`}
          render={props => <StatsSummary {...props} messaging={messaging} />}
        />
        <Route
          exact
          path={`${prefix}/stats/transfers`}
          render={props => <StatsTransfers {...props} messaging={messaging} />}
        />
        <Route exact path={`${prefix}/stats/gas`} render={props => <StatsGas {...props} messaging={messaging} />} />
        <Route
          exact
          path={`${prefix}/stats/export`}
          render={props => <StatsExport {...props} messaging={messaging} />}
        />
      </Switch>
    </TopGrid>
  );
}

export default Stats;
