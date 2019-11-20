import React from "react";
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

const StatsSummary = async () => {
  const { classes } = props;

  const [allChannels, setAllChannels] = useState(null);

  useEffect(() => {
    if (!messaging) {
      return;
    }
    (async () => {
      const getChannels = async () => {
        // var res = await messaging.request(
        //   "admin.get-channel-states",
        //   5000,
        //   {
        //     userPublicIdentifier:
        //       "xpub6DgQCJcuAkGqtpzj3eHC7uLatyyPoNGQVegrRsSWFyHVXCZb4PVo6b8sRCHDJuEMfJsfaoB64AjaouN8mdAWpLEGMffwcZetbDx9M5Z9AKg",
        //   },
        //   {
        //     token: "foo",
        //   },
        // );
        var res = await messaging.request("admin.get-all-channel-states", 5000, {
          token: token,
        });
        setAllChannels(res);
      };
      await getChannels();
    })();
  });
  return (
    <Grid className={classes.top} container>
      <Typography className={classes.cardText}>Hello</Typography>
      <Typography className={classes.cardText}>World</Typography>
    </Grid>
  );
};

StatsSummary.propTypes = {
  classes: PropTypes.object.isRequired,
};
export default withStyles(styles)(StatsSummary);
