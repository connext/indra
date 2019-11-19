import {
  Button,
  InputAdornment,
  Modal,
  TextField,
  Tooltip,
} from "@material-ui/core";
import { arrayify, isHexString } from "ethers/utils";
import React, { useEffect, useState } from "react";
import QRIcon from "mdi-material-ui/QrcodeScan";

import { QRScan } from "./qrCode";

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay)
    return () => clearTimeout(handler);
  }, [value]);
  return debouncedValue;
}

export const useAddress = (address, ethProvider, network) => {
  const [recipientDisplay, setRecipientDisplay] = useState(null);
  const [recipientValue, setRecipientValue] = useState(null);
  const [recipientError, setRecipientError] = useState(null);
  const debouncedRecipient = useDebounce(recipientDisplay, 1000);
  useEffect(() => {
    (async () => {
      if (debouncedRecipient === null) return;
      let newVal = debouncedRecipient;
      let error;
      if (debouncedRecipient.startsWith("ethereum:")) {
        newVal = debouncedRecipient.split(":")[1];
      }
      if (network.ensAddress && newVal.endsWith('.eth')) {
        newVal = await ethProvider.resolveName(newVal);
      }
      if (newVal === "") {
        error = "Please provide an address or ens name";
      } else if (!isHexString(newVal)) {
        error = `Invalid hex string`;
      } else if (arrayify(newVal).length !== 20) {
        error = `Invalid length: ${newVal.length} (expected 42)`;
      }
      setRecipientValue(error ? undefined : newVal);
      setRecipientError(error);
    })()
  }, [debouncedRecipient]);
  return [
    { display: recipientDisplay, value: recipientValue, error: recipientError },
    setRecipientDisplay,
  ];
}

export const AddressInput = ({ address, setAddress }) => {
  const [scan, setScan] = useState(false);
  return (
    <div>
      <TextField
        style={{ width: "100%" }}
        id="outlined-with-placeholder"
        label="Address"
        placeholder="0x0..."
        value={address.display || ""}
        onChange={evt => setAddress(evt.target.value)}
        margin="normal"
        variant="outlined"
        required
        helperText={address.error}
        error={!!address.error}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
                <Button
                  disableTouchRipple
                  variant="contained"
                  color="primary"
                  style={{ color: "primary" }}
                  onClick={() => setScan(true)}
                >
                  <QRIcon />
                </Button>
              </Tooltip>
            </InputAdornment>
          ),
        }}
      />
      <Modal
        id="qrscan"
        open={scan}
        onClose={() => setScan(false)}
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          position: "absolute",
          top: "10%",
          width: "375px",
          marginLeft: "auto",
          marginRight: "auto",
          left: "0",
          right: "0",
        }}
      >
        <QRScan handleResult={(res) => {
          setAddress(res);
          setScan(false);
        }} />
      </Modal>
    </div>
  );
}

