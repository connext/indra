import { Button, InputAdornment, Modal, TextField, Tooltip } from "@material-ui/core";
import React, { useEffect, useState } from "react";
import QRIcon from "mdi-material-ui/QrcodeScan";
import { utils } from "ethers";

import { resolveAddress } from "../utils";
import { QRScan } from "./qrCode";

const { isHexString } = utils;

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export const useAddress = (initialAddress, ethProvider) => {
  const [network, setNetwork] = useState(null);
  const [display, setDisplay] = useState(initialAddress);
  const [resolved, setResolved] = useState(false);
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);
  const debounced = useDebounce(display, 1000);
  useEffect(() => {
    (async () => {
      await ethProvider.ready;
      const network = await ethProvider.getNetwork();
      setNetwork(network);
    })();
  }, [ethProvider]);
  useEffect(() => {
    (async () => {
      if (debounced === null) return;
      const addressLen = 42;
      let value = debounced;
      let error = null;
      setResolved(false);
      if (network && network.ensAddress && value.endsWith(".eth")) {
        setResolved("pending");
        value = await resolveAddress(value, ethProvider, network);
        setResolved(true);
      }
      if (value && value.endsWith(".eth")) {
        error = `Network "${network.name}" (chainId ${network.chainId}) doesn"t support ENS`;
      } else if (!value || !isHexString(value)) {
        error = `Invalid address: ${value}`;
      }
      if (!error && value.length !== addressLen) {
        error = `Invalid length: ${value.length} (expected ${addressLen})`;
      }
      setValue(error ? undefined : value);
      setError(error);
    })();
  }, [debounced, ethProvider, network]);
  return [{ display, value, error, resolved }, setDisplay, setError];
};

export const AddressInput = ({ address, setAddress }) => {
  const [scan, setScan] = useState(false);
  return (
    <div>
      <TextField
        fullWidth
        id="outlined"
        label="Recipient Address"
        type="string"
        value={address.display || ""}
        onChange={(evt) => setAddress(evt.target.value)}
        margin="normal"
        variant="outlined"
        helperText={
          (address.resolved === "pending" ? `Resolving ENS name...` : "") ||
          address.error ||
          (address.value && address.resolved === true
            ? `ENS name resolved to: ${address.value.substring(0, 42)}...`
            : false) ||
          (address.value ? "" : "Ignored for linked payments")
        }
        error={address.error !== null}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
                <Button
                  disableTouchRipple
                  variant="contained"
                  color="primary"
                  style={{ color: "#FFF" }}
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
        <QRScan
          handleResult={(res) => {
            // Extract the address from a request link if necessary
            const i = res.indexOf("=address");
            if (i !== -1) {
              setAddress(res.substring(i + 1, i + 112));
            } else {
              setAddress(res);
            }
            setScan(false);
          }}
        />
      </Modal>
    </div>
  );
};

export const usePublicIdentifier = (initialAddress, ethProvider) => {
  const [network, setNetwork] = useState(null);
  const [display, setDisplay] = useState(initialAddress);
  const [resolved, setResolved] = useState(false);
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);
  const debounced = useDebounce(display, 1000);
  useEffect(() => {
    (async () => {
      await ethProvider.ready;
      const network = await ethProvider.getNetwork();
      setNetwork(network);
    })();
  }, [ethProvider]);
  useEffect(() => {
    (async () => {
      if (debounced === null) return;
      let value = debounced;
      let error = null;
      setResolved(false);
      if (network && network.ensAddress && value.endsWith(".eth")) {
        setResolved("pending");
        value = await resolveAddress(value, ethProvider, network);
        setResolved(true);
      }
      if (value && value.endsWith(".eth")) {
        error = `Network "${network.name}" (chainId ${network.chainId}) doesn"t support ENS`;
      } else if (!value || !value.startsWith("indra")) {
        error = `Invalid public identifier: should start with "indra"`;
      }
      if (!error && value.length !== 54 && value.length !== 55) {
        error = `Invalid length: ${value.length} (expected 54-55)`;
      }
      setValue(error ? undefined : value);
      setError(error);
    })();
  }, [debounced, ethProvider, network]);
  return [{ display, value, error, resolved }, setDisplay, setError];
};

export const PublicIdentifierInput = ({ address, setAddress }) => {
  const [scan, setScan] = useState(false);
  return (
    <div>
      <TextField
        fullWidth
        id="outlined"
        label="Recipient Public Identifier"
        type="string"
        value={address.display || ""}
        onChange={(evt) => setAddress(evt.target.value)}
        margin="normal"
        variant="outlined"
        helperText={
          (address.resolved === "pending" ? `Resolving ENS name...` : "") ||
          address.error ||
          (address.value && address.resolved === true
            ? `ENS name resolved to: ${address.value.substring(0, 42)}...`
            : false) ||
          (address.value ? "" : "Ignored for linked payments")
        }
        error={address.error !== null}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
                <Button
                  disableTouchRipple
                  variant="contained"
                  color="primary"
                  style={{ color: "#FFF" }}
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
        <QRScan
          handleResult={(res) => {
            // Extract the address from a request link if necessary
            const i = res.indexOf("=address");
            if (i !== -1) {
              setAddress(res.substring(i + 1, i + 112));
            } else {
              setAddress(res);
            }
            setScan(false);
          }}
        />
      </Modal>
    </div>
  );
};
