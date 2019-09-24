import {
  Button,
  Grid,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import { Zero } from "ethers/constants";
import React, { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { Currency } from "../utils";

import { QRGenerate } from "./qrCode";
import { MySnackbar } from "./snackBar";

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px"
  }
}));

const generateQrUrl = (value, xpub) =>
  `${window.location.origin}/send?amountToken=${value || "0"}&recipient=${xpub}`;

export const RequestCard = style((props) => {
  const { maxDeposit, xpub } = props;

  const [displayValue, setDisplayValue] = useState("");
  const [error, setError] = useState(undefined);
  const [qrUrl, setQrUrl] = useState(generateQrUrl("0", xpub));
  const [copied, setCopied] = useState(false);

  const closeModal = () => {
    setCopied(false);
  };

  const handleCopy = () => {
    setCopied(error ? false : true);
  }

  const updatePaymentHandler = (rawValue) => {
    let value, error
    try {
      value = Currency.DAI(rawValue)
    } catch (e) {
      error = e.message
    }
    if (value && value.wad.gt(maxDeposit.toDAI().wad)) {
      error = `Channel balances are capped at ${maxDeposit.toDAI().format()}`
    }
    if (value && value.wad.lte(Zero)) {
      error = "Please enter a payment amount above 0"
    }
    setQrUrl(generateQrUrl(error ? "0" : value.amount, xpub));
    setDisplayValue(rawValue);
    setError(error);
  };

  return (
    <Grid
      container
      spacing={2}
      direction="column"
      style={{
        paddingLeft: "10%",
        paddingRight: "10%",
        paddingTop: "10%",
        paddingBottom: "10%",
        textAlign: "center",
        justifyContent: "center"
      }}
    >
      <MySnackbar
        variant="success"
        openWhen={copied}
        onClose={closeModal}
        message="Copied!"
      />
      <Grid item xs={12}>
        <QRGenerate value={qrUrl} />
      </Grid>
      <Grid item xs={12}>
        <CopyToClipboard
          onCopy={handleCopy}
          text={xpub}
        >
          <Button variant="outlined" fullWidth>
            <Typography noWrap variant="body1">
              <Tooltip
                disableFocusListener
                disableTouchListener
                title={"Click to Copy"}
              >
                <span>{xpub}</span>
              </Tooltip>
            </Typography>
          </Button>
        </CopyToClipboard>
      </Grid>
      <Grid item xs={12}>
        <CopyToClipboard
          onCopy={handleCopy}
          text={error ? '' : qrUrl}
        >
          <Button variant="outlined" fullWidth>
            <Typography noWrap variant="body1">
              <Tooltip
                disableFocusListener
                disableTouchListener
                title={error ? "Fix amount first" : "Click to Copy"}
              >
                <span>{qrUrl}</span>
              </Tooltip>
            </Typography>
          </Button>
        </CopyToClipboard>
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          id="outlined-number"
          label="Amount"
          value={displayValue}
          type="number"
          margin="dense"
          variant="outlined"
          onChange={evt => updatePaymentHandler(evt.target.value)}
          error={!!error}
          helperText={error}
        />
      </Grid>
      <Grid item xs={12}>
        <Button
          variant="outlined"
          style={{
            background: "#FFF",
            border: "1px solid #F22424",
            color: "#F22424",
            width: "15%"
          }}
          size="medium"
          onClick={() => props.history.push("/")}
        >
          Back
        </Button>
      </Grid>
    </Grid>
  );
});
