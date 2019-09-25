import { Button, Fab, Grid, Modal, withStyles } from "@material-ui/core";
import { SaveAlt as ReceiveIcon, Send as SendIcon } from "@material-ui/icons";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React from "react";
import { Link } from "react-router-dom";

import "../App.css";

import { ChannelCard } from "./channelCard";
import { QRScan } from "./qrCode";

const styles = {};

class Home extends React.Component {
  state = {
    scanModal: false,
    history: [],
  };

  scanQRCode = async (data) => {
    const path = await this.props.scanQRCode(data);
    this.setState({ scanModal: false })
    this.props.history.push(path)
  };

  render() {
    return (
      <>
        <Grid container direction="row" style={{ marginBottom: "-7.5%" }}>
          <Grid item xs={12} style={{ flexGrow: 1 }} >
            <ChannelCard balance={this.props.balance} />
          </Grid>
        </Grid>
        <Grid container direction="column">
          <Grid item xs={12} style={{ marginRight: "5%", marginLeft: "80%" }} >
            <Fab
              style={{
                color: "#FFF",
                backgroundColor: "#fca311",
                size: "large"
              }}
              onClick={() => this.setState({ scanModal: true })}
            >
              <QRIcon />
            </Fab>
            <Modal
              id="qrscan"
              open={this.state.scanModal}
              onClose={() => this.setState({ scanModal: false })}
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
                right: "0"
              }}
            >
              <QRScan
                handleResult={this.scanQRCode}
                history={this.state.history}
              />
            </Modal>
          </Grid>
        </Grid>
        <Grid
          container
          spacing={4}
          direction="column"
          style={{ paddingLeft: "2%", paddingRight: "2%", textAlign: "center" }}
        >
          <Grid item xs={12} style={{ paddingTop: "10%" }}>
            <Grid
              container
              spacing={8}
              direction="row"
              alignItems="center"
              justify="center"
            >
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  style={{
                    color: "#FFF",
                    backgroundColor: "#FCA311"
                  }}
                  variant="contained"
                  size="large"
                  component={Link}
                  to="/request"
                >
                  Request
                  <ReceiveIcon style={{ marginLeft: "5px" }} />
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  style={{
                    color: "#FFF",
                    backgroundColor: "#FCA311"
                  }}
                  size="large"
                  variant="contained"
                  component={Link}
                  to="/send"
                >
                  Send
                  <SendIcon style={{ marginLeft: "5px" }} />
                </Button>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12}>
            <Button
              style={{ marginBottom: "20%" }}
              fullWidth
              color="primary"
              variant="outlined"
              size="large"
              component={Link}
              to="/cashout"
            >
              Cash Out
            </Button>
          </Grid>
        </Grid>
      </>
    );
  }
}

export default withStyles(styles)(Home);
