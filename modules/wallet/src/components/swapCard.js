import React, {Component} from 'react';
import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import SwapHoriz from '@material-ui/icons/SwapHoriz';
import TextField from '@material-ui/core/TextField';
import { withStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';
import Switch from '@material-ui/core/Switch';
import HelpIcon from '@material-ui/icons/Help';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';




class SwapCard extends Component {
  constructor(props) {
    super(props);
  }
  state={  
    anchorEl: null,
    displayVal:'0',
    exchangeVal: '0',
    exchangeRate: '0.00'
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


  async updateExchangeHandler(evt) {
    var value = evt.target.value;
      this.setState({
        displayVal: evt.target.value,
      });
    await this.setState(oldState => {
      oldState.exchangeVal = value;
      return oldState;
    });
    console.log(`Updated exchangeVal: ${JSON.stringify(this.state.exchangeVal, null, 2)}`);
  }

  async exchangeHandler() {
    console.log(`Exchanging: ${JSON.stringify(this.state.exchangeVal, null, 2)}`);
    let exchangeRes = await this.props.connext.exchange(this.state.exchangeVal, "wei");
    console.log(`Exchange Result: ${JSON.stringify(exchangeRes, null, 2)}`);
  }


  render(){
    const { anchorEl } = this.state;
    const open = Boolean(anchorEl);

    const cardStyle = {
      card:{
        display:'flex',
        flexWrap:'wrap',
        flexBasis:'120%',
        flexDirection:'row',
        width: '230px',
        height:'100%',
        justifyContent:'center',
        backgroundColor:"#EAEBEE",
        padding: '4% 4% 4% 4%'
      },
      icon:{
        width:'50px',
        height:'50px',
        paddingTop:'8px'
      },
      input:{
        width:'100%'
      },
      button:{
        width:'100%',
        height:'40px'
      },
      col1:{
        marginLeft:'55px',
        width:'40%',
        justifyContent:"'flex-end' !important"
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
          <SwapHoriz style={cardStyle.icon} />
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
            <Typography style={cardStyle.popover} > OPTIONAL. If you'd like to swap ETH for <br />tokens, you can do it in-channel. </Typography>
          </Popover>
          </div>
          <div>
          Only ETH to Token in-channel swaps are currently available.
          </div>
          <TextField
            style={cardStyle.input}
            id="outlined-number"
            label="Amount (Wei)"
            value={this.state.displayVal}
            onChange={evt => this.state.updateExchangeHandler(evt)}
            type="number"
            margin="normal"
            variant="outlined"
          />
          <div>Rate: 1 ETH = {this.props.exchangeRate} TST</div>
          <Button style={cardStyle.button} 
                  onClick={() => this.exchangeHandler}
                  variant="contained" 
                  color="primary">
            Swap
          </Button>
      </Card>
    );
  };
}

export default SwapCard;

