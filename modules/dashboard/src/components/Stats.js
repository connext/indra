import React from "react";
import { Button, Grid, Typography, withStyles } from "@material-ui/core";
import { Home as HomeIcon } from "@material-ui/icons";

import { Switch, Route, Link } from "react-router-dom";
import PropTypes from "prop-types";
import StatsSummary from "./StatsSummary";
import StatsGas from "./StatsGas";
import StatsTransfers from "./StatsTransfers";
import StatsExport from "./StatsExport";

const styles = {
  top: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height: "100%",
  },
  appBar: {
    width: "100%",
    paddingTop: "15px",
    justifyContent: "flex-start",
  },
  button: {
    display: "flex",
    height: "45px",
    alignItems: "center",
    justifyContent: "center",
    margin: "0% 1% 0% 1%",
    paddingLeft: "1%",
    paddingRight: "1%",
    // border: "1px solid #002868",
    textDecoration: "none",
    "&:hover": { backgroundColor: "rgba(0,40,104,0.2)" },
  },
  buttonText: {
    textAlign: "center",
    fontSize: "24px",
    color: "#002868",
    textDecoration: "none",
    paddingLeft: "2%",
    paddingRight: "2%",
  },
  icon: { color: "#002868" },
};

function Stats({ classes, messaging, prefix }) {
  return (
    <Grid className={classes.top} container>
      <Grid className={classes.appBar} container>
        <Button className={classes.button} component={Link} to={`${prefix}`}>
          <HomeIcon className={classes.icon} />
        </Button>
        <Button className={classes.button} component={Link} to={`${prefix}/stats/summary`}>
          <Typography className={classes.buttonText}>Summary</Typography>
        </Button>
        <Button className={classes.button} component={Link} to={`${prefix}/stats/transfers`}>
          <Typography className={classes.buttonText}>Transfers</Typography>
        </Button>

        <Button className={classes.button} component={Link} to={`${prefix}/stats/gas`}>
          <Typography className={classes.buttonText}>Gas</Typography>
        </Button>

        <Button className={classes.button} component={Link} to={`${prefix}/stats/export`}>
          <Typography className={classes.buttonText}>Export</Typography>
        </Button>
      </Grid>
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
        <Route
          exact
          path={`${prefix}/stats/gas`}
          render={props => <StatsGas {...props} messaging={messaging} />}
        />
        <Route
          exact
          path={`${prefix}/stats/export`}
          render={props => <StatsExport {...props} messaging={messaging} />}
        />
      </Switch>
    </Grid>
  );
}

Stats.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(Stats);
