import React from 'react';
import ReactDOM from 'react-dom';
import Index from './pages/index';
import * as serviceWorker from './serviceWorker';

console.log(`Starting dashboard in env: ${JSON.stringify(process.env,null,2)}`)

const origin = window.location.origin
const prefix = process.env.REACT_APP_PUBLIC_URL || `/dashboardd`
const publicUrl = `${origin}${prefix}`

const urls = {
  prefix: prefix,
  public: publicUrl,
  api: process.env.REACT_APP_API_URL || `${origin}/api${prefix}`,
  hub: process.env.REACT_APP_HUB_URL || `${origin}/api/hub`,
  eth: process.env.REACT_APP_ETH_URL || `${origin}/api/eth`
}

console.log(`Using URLs: ${JSON.stringify(urls,null,2)}`)

ReactDOM.render(
  <Index urls={urls}/>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.register();
