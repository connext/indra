import React, {Component} from 'react';
import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import SendIcon from '@material-ui/icons/Send';
import TextField from '@material-ui/core/TextField';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Switch from '@material-ui/core/Switch';
import HelpIcon from '@material-ui/icons/Help';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';




class PayCard extends Component {
  state = {
    checkedA: true,
    checkedB: true,
    anchorEl: null,
    paymentVal: {
      meta: {
        purchaseId: "payment"
      },
      payments: [
        {
          recipient: "0x0",
          amount: {
            amountWei: "0",
            amountToken: "0"
          }
        }
      ]
    },
    displayVal:'0',
    recipientDisplayVal:'0x0...'
  };

  handleClick = event => {
    console.log("click handled")
    this.setState({
      anchorEl: event.currentTarget,
    });
  };

  handleClose = () => {
    this.setState({
      anchorEl: null,
    });
  };

  handleChange = name => event => {
    var valWei = this.state.paymentVal.payments[0].amount.amountWei
    var valToken = this.state.paymentVal.payments[0].amount.amountToken
    this.setState({ [name]: event.target.checked });
    if (this.state.checkedB){
      this.setState({displayVal: valWei})
    }else{
      this.setState({displayVal: valToken})
    }
    
  };
  
  async updatePaymentHandler(evt) {
    var value = evt.target.value;
    this.setState({
      displayVal: evt.target.value,
    });
    if (!this.state.checkedB) {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].amount.amountWei = value;
        return oldState;
      });
    } else if (this.state.checkedB) {
      await this.setState(oldState => {
        oldState.paymentVal.payments[0].amount.amountToken = value;
        return oldState;
      });
    }
    console.log(`Updated paymentVal: ${JSON.stringify(this.state.paymentVal, null, 2)}`);
  }

  async updateRecipientHandler(evt) {
    var value = evt.target.value;
    this.setState({
      recipientDisplayVal: evt.target.value,
    });
    await this.setState(oldState => {
      oldState.paymentVal.payments[0].recipient = value;
      return oldState;
    });
    console.log(`Updated recipient: ${JSON.stringify(this.state.paymentVal.payments[0].recipient, null, 2)}`);
  }


  async paymentHandler() {
    console.log(`Submitting payment: ${JSON.stringify(this.state.paymentVal, null, 2)}`);
    let paymentRes = await this.props.connext.buy(this.state.paymentVal);
    console.log(`Payment result: ${JSON.stringify(paymentRes, null, 2)}`);
  }

  render(){
    const { anchorEl } = this.state;
    const open = Boolean(anchorEl);
    const cardStyle = {
      card:{
        display:'flex',
        flexWrap:'wrap',
        flexBasis:'100%',
        flexDirection:'row',
        width: '230px',
        justifyContent:'center',
        backgroundColor:"#EAEBEE",
        padding: '4% 4% 4% 4%'
      },
      icon:{
        width:'50px',
        height:'50px',
        paddingTop:'8px',
        right:'0'
      },
      input:{
        width:'100%'
      },
      button:{
        width:'100%',
        height:'40px'
      },
      col1:{
        marginLeft: '55px',
        width:'40%'
      },
      col2:{
        width:'3%',
        justifyContent:"'flex-end' !important"
      },
      popover:{
        padding:'8px 8px 8px 8px'
      }
    }


    return (
      <Card style={cardStyle.card}>
          <div style={cardStyle.col1}>
          <SendIcon style={cardStyle.icon} />
        </div>
        <div style={cardStyle.col2}>
        <IconButton style={cardStyle.helpIcon} 
                    aria-owns={open ? 'simple-popper' : undefined}
                    aria-haspopup="true"
                    variant="contained"
                    onClick={this.handleClick}>
            <HelpIcon/>
        </IconButton>
        <Popover
            id="simple-popper"
            open={open}
            anchorEl={anchorEl}
            onClose={this.handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
          >
            <Typography style={cardStyle.popover} >Here, you can pay a counterparty using <br />your offchain funds. 
                                                    Enter the recipient address and the amount in tokens or ETH, then click
                                                    Pay. </Typography>
          </Popover>
          </div>
          <div>
          ETH
          <Switch
            checked={this.state.checkedB}
            onChange={this.handleChange('checkedB')}
            value="checkedB"
            color="primary"
          />
          TST
          </div>
          <TextField
            style={cardStyle.input}
            id="outlined-with-placeholder"
            label="Address"
            placeholder="Receiver (0x0...)"
            value={this.state.recipientDisplayVal}
            onChange={evt => this.updateRecipientHandler(evt)}
            margin="normal"
            variant="outlined"
            />
          <TextField
            style={cardStyle.input}
            id="outlined-number"
            label="Amount (Wei)"
            placeholder="Amount (Wei)"
            value={this.state.displayVal}
            onChange={evt => this.updatePaymentHandler(evt)}
            type="number"
            margin="normal"
            variant="outlined"
          />
          <Button style={cardStyle.button} 
                  onClick={() => this.paymentHandler()}
                  variant="contained" 
                  color="primary">
            Pay
          </Button>
      </Card>
    );
  };
}

export default PayCard;

