import React from 'react';
import ReactDOM from 'react-dom';
import Index from './pages/index';
import * as serviceWorker from './serviceWorker';

console.log(`Starting dashboard in env: ${JSON.stringify(process.env,null,2)}`)

const apiUrl = process.env.REACT_APP_API_URL || `http://localhost:9999`
const hubUrl = process.env.REACT_APP_HUB_URL || `http://localhost:8080`
const ethUrl = process.env.REACT_APP_ETH_URL || `http://localhost:8545`

ReactDOM.render(<Index ethUrl={ethUrl} hubUrl={hubUrl} apiUrl={apiUrl}/>, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
