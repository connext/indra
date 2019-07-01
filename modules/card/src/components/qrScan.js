import React, { Component } from "react";
import QrReader from "react-qr-reader";
import {Typography} from "@material-ui/core";

class QRScan extends Component {
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

export default QRScan;
