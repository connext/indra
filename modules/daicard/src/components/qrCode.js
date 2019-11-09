import { Typography } from "@material-ui/core";
import QrCode from "qrcode.react";
import React from "react";
import QrReader from "react-qr-reader";

export const QRGenerate = ({ size, value }) => {
  return <QrCode value={value} size={size || 256} />;
};

export const QRScan = React.forwardRef(({ handleResult }, ref) => {
  return (
    <div tabIndex={-1} ref={ref}>
      <QrReader
        delay={300}
        onError={console.error}
        onScan={data => (data ? handleResult(data) : undefined)}
        style={{ width: "100%" }}
      />
      <Typography style={{ padding: "2%", backgroundColor: "#FFF" }}>
        Not currently supported on Brave and iOS 11 browsers other than Safari.
      </Typography>
    </div>
  );
});
