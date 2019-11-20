import {
  Button,
  InputAdornment,
  Modal,
  TextField,
  Tooltip,
} from "@material-ui/core";
import React, { useEffect, useState } from "react";
import QRIcon from "mdi-material-ui/QrcodeScan";

import { resolveXpub } from "../../utils";
import { QRScan } from "../qrCode";
import { useDebounce } from "./utils";

export const useXpub = (initialXpub, ethProvider) => {
  const [network, setNetwork] = useState(null);
  const [display, setDisplay] = useState(initialXpub);
  const [resolved, setResolved] = useState(false);
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);
  const debounced = useDebounce(display, 1000);
  useEffect(() => {
    (async () => {
      await ethProvider.ready;
      const network = await ethProvider.getNetwork();
      setNetwork(network);
    })()
  }, []);
  useEffect(() => {
    (async () => {
      if (debounced === null) return;
      const xpubLen = 111;
      let value = debounced;
      let error = null;
      setResolved(false);
      if (network && network.ensAddress && value.endsWith(".eth")) {
        setResolved("pending");
        value = await resolveXpub(value, ethProvider, network);
        setResolved(true);
      }
      if (value && value.endsWith(".eth")) {
        error = `Network "${network.name}" (chainId ${network.chainId}) doesn"t support ENS`;
      } else if (!value || !value.startsWith("xpub")) {
        error = `Invalid xpub: should start with "xpub"`;
      }
      if (!error && value.length !== xpubLen) {
        error = `Invalid length: ${value.length} (expected ${xpubLen})`;
      }
      setValue(error ? undefined : value);
      setError(error);
    })()
  }, [debounced]);
  return [
    { display, value, error, resolved },
    setDisplay,
    setError,
  ];
}

export const XpubInput = ({ xpub, setXpub }) => {
  const [scan, setScan] = useState(false);
  return (
    <div>
      <TextField
        fullWidth
        id="outlined"
        label="Recipient Public Identifier"
        type="string"
        value={xpub.display || ""}
        onChange={evt => setXpub(evt.target.value)}
        margin="normal"
        variant="outlined"
        helperText={
          (xpub.resolved === 'pending' ? `Resolving ENS name...` : '')
          || xpub.error
          || (xpub.value && xpub.resolved === true ? `ENS name resolved to: ${xpub.value.substring(0, 42)}...` : false)
          || (xpub.value ? "" : "Ignored for linked payments")
        }
        error={xpub.error !== null}
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
        <QRScan handleResult={(res) => {
          // Extract the xpub from a request link if necessary
          const i = res.indexOf('=xpub')
          if (i !== -1) {
            setXpub(res.substring(i + 1, i + 112));
          } else {
            setXpub(res);
          }
          setScan(false);
        }} />
      </Modal>
    </div>
  );
}


