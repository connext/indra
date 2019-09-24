import { Typography } from "@material-ui/core";
import QrCode from "qrcode.react";
import React, { useState } from "react";
import QrReader from "react-qr-reader";

export const QRGenerate = (props) => {
  return (
    <QrCode value={props.value} size={256} />
  )
}

export const QRScan = (props) => {
  const [delay, setDelay] = useState(300);
  const [result, setResult] = useState("No result");
  const [error, setError] = useState(undefined);
  const { handleResult } = props;

  const handleScan = data => {
    if (data) {
      handleResult(data);
    }
  };

  return (
    <div>
      <QrReader
        delay={delay}
        onError={setError}
        onScan={handleScan}
        style={{ width: "100%" }}
      />
      <Typography style={{padding: "2%", backgroundColor: "#FFF"}}>
        Not currently supported on Brave and iOS 11 browsers other than Safari.
      </Typography>
    </div>
  );
}
