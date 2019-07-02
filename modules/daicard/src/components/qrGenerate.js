import QrCode from "qrcode.react";
import React from "react";

const QRGenerate = props => <QrCode value={props.value} size={256} />;

export default QRGenerate;
