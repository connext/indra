import React from "react";
import QrCode from "qrcode.react";

const QRGenerate = props => <QrCode value={props.value} size={256} />;

export default QRGenerate;
