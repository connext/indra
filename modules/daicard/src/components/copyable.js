import { Button, Grid, Tooltip, Typography, withStyles } from "@material-ui/core";
import { FileCopy as CopyIcon } from "@material-ui/icons";
import React, { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { MySnackbar } from "./snackBar";

const style = {
  button: {
    justifyContent: "center",
    textTransform: "none",
  },
  top: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
};

const Copyable = props => {
  const [copied, setCopied] = useState(false);
  const { classes, color, size, tooltip, text } = props;
  return (
    <Grid item xs={12} className={classes.top}>
      <CopyToClipboard onCopy={() => setCopied(true)} text={text}>
        <Button
          disableTouchRipple
          className={classes.button}
          color={color || "inherit"}
          fullWidth
          size={size || "medium"}
          variant="outlined"
        >
          <CopyIcon style={{ marginRight: "5px", color: "#002868" }} />
          <Typography noWrap variant="body1">
            <Tooltip disableTouchListener title={tooltip || text}>
              <span style={{ color: "#002868" }}>{text}</span>
            </Tooltip>
          </Typography>
        </Button>
      </CopyToClipboard>
      <MySnackbar
        variant="success"
        openWhen={copied}
        onClose={() => setCopied(false)}
        message="Copied!"
      />
    </Grid>
  );
};
export default withStyles(style)(Copyable);
