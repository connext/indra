import { Typography } from "@material-ui/core";
import QrCode from "qrcode.react";
import React, { Component } from "react";
import QrReader from "react-qr-reader";

export const QRGenerate = props => <QrCode value={props.value} size={256} />;

export class QRScan extends Component {
  constructor(props) {
    super(props);
    this.state = {
      delay: 300,
      result: "No result",
      error: null
    };
  }

  handleScan = data => {
    if (data) {
      this.props.handleResult(data);
    }
  };

  render() {
    return (
      <div>
        <QrReader
          delay={this.state.delay}
          onError={error => this.setState({ error })}
          onScan={this.handleScan}
          style={{ width: "100%" }}
        />
        <Typography style={{padding: "2%", backgroundColor: "#FFF"}}>
          Not currently supported on Brave and iOS 11 browsers other than Safari.
        </Typography>
      </div>
    );
  }
}
