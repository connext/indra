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

import { resolveAddress } from "../../utils";
import { QRScan } from "../qrCode";
import { useDebounce } from "./utils";

export const useAddress = (initialAddress, ethProvider) => {
  const [display, setDisplay] = useState(initialAddress);
  const [error, setError] = useState(null);
  const [network, setNetwork] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [value, setValue] = useState(null);
  const debouncedAddress = useDebounce(display, 1000);
  useEffect(() => {
    (async () => {
      await ethProvider.ready;
      const network = await ethProvider.getNetwork();
      setNetwork(network);
    })()
  }, []);
  useEffect(() => {
    (async () => {
      if (debouncedAddress === null) return;
      let value = debouncedAddress;
      let error;
      if (debouncedAddress.startsWith("ethereum:")) {
        value = debouncedAddress.split(":")[1];
      }
      setResolved(false);
      if (network && network.ensAddress && value.endsWith(".eth")) {
        setResolved("pending");
        value = await resolveAddress(value, ethProvider, network);
        setResolved(true);
      }
      if (typeof value === "string" && value.endsWith(".eth")) {
        error = `Network "${network.name}" (chainId ${network.chainId}) doesn"t support ENS`;
      } else if (value === "") {
        error = "Please provide an address or ens name";
      } else if (!isHexString(value)) {
        error = `Invalid hex string`;
      } else if (arrayify(value).length !== 20) {
        error = `Invalid length: ${value.length} (expected 42)`;
      }
      setValue(error ? undefined : value);
      setError(error);
    })()
  }, [debouncedAddress, network]);
  return [
    { display, value, error, resolved },
    setDisplay,
    setError,
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
        helperText={
          (address.resolved === 'pending' ? `Resolving ENS name...` : '')
          || address.error
          || (address.resolved === true ? `ENS name resolved to: ${address.value}` : false)
        }
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

