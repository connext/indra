import React from "react";
import { Button, Grid, Typography, withStyles } from "@material-ui/core";
import { Switch, Route,Link } from "react-router-dom";
import PropTypes from "prop-types";
import DebugChannel from "./DebugChannel";
import DebugTransfer from "./DebugTransfer";
import { Home as HomeIcon} from "@material-ui/icons";

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
  },
  button: {
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
  },
  buttonText: {
    textAlign: "center",
    fontSize: "24px",
    color: "#002868",
    textDecoration: "none",
    paddingLeft:"2%",
    paddingRight:"2%",
  },
};

function Debug(props) {
  const { classes, messaging, token } = props;
  console.log(messaging)
  return (
    <Grid className={classes.top} container>
      <Grid className={classes.appBar} container>
      <Button className={classes.button} component={Link} to={"/dashboard"}>
          <HomeIcon className={classes.icon} />
        </Button>
        <Button className={classes.button} component={Link} to={"/dashboard/debug/channel"}>
          <Typography className={classes.buttonText}>Channels</Typography>
        </Button>
        <Button className={classes.button} component={Link} to={"/dashboard/debug/transfer"}>
          <Typography className={classes.buttonText}>Transfer</Typography>
        </Button>

      </Grid>
        <Switch>
          <Route exact path="/dashboard/debug/channel" render={props => <DebugChannel {...props} messaging={messaging} token={token} />} />
          <Route exact path="/dashboard/debug/transfer" render={props => <DebugTransfer {...props} messaging={messaging} token={token}  />} />
        </Switch>
    </Grid>
  );
}

Debug.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(Debug);
