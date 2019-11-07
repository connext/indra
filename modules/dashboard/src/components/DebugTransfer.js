import React, { useEffect, useState } from "react";
import { Grid, Typography, withStyles } from "@material-ui/core";
import PropTypes from "prop-types";

const styles = {
  top: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginTop: "15%",
    display: "flex",
    height: "320px",
    width: "320px",
    alignItems: "center",
    justifyContent: "center",
    margin: "0% 2% 0% 2%",
    border: "3px solid #002868",
    textDecoration: "none",
    "&:hover": { backgroundColor: "rgba(0,40,104,0.2)" },
  },
  cardText: {
    textAlign: "center",
    fontSize: "24px",
    color: "#002868",
    textDecoration: "none",
  },
};

const DebugTransfer = props => {
  const { classes } = props;

  const [messaging, setMessaging] = useState(props.messaging);
  const [testEndpoint, setTestEndpoint] = useState(null);

  useEffect(() => {
    (async () => {
      const getNoFreeBalance = async () => {
        var res = await messaging.request("admin.get-no-free-balance", 5000, {
          token: "foo",
        });
        setTestEndpoint(JSON.stringify(res));
      };
      await getNoFreeBalance();
    })();
  });

  return (
    <Grid className={classes.top} container>
      <Typography className={classes.cardText}>{testEndpoint}</Typography>
    </Grid>
  );
};

DebugTransfer.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(DebugTransfer);
