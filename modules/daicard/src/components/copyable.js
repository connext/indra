import { Button, Grid, Tooltip, Typography, withStyles } from "@material-ui/core";
import { FileCopy as CopyIcon } from "@material-ui/icons";
import React, { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { MySnackbar } from "./snackBar";

const style = withStyles(theme => ({
  label: {
    textTransform: "none",
  },
}));

export const Copyable = style(props => {
  const [copied, setCopied] = useState(false);
  const { classes, color, size, tooltip, text } = props;
  return (
    <Grid item xs={12}>
      <CopyToClipboard onCopy={() => setCopied(true)} text={text}>
        <Button
          disableTouchRipple
          classes={classes}
          color={color || "inherit"}
          fullWidth
          size={size || "medium"}
          variant="outlined"
        >
          <CopyIcon style={{ marginRight: "5px" }} />
          <Typography noWrap variant="body1">
            <Tooltip disableTouchListener title={tooltip || text}>
              <span>{text}</span>
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
});
