const eth = require('ethers')
const tokenArtifacts = require('openzeppelin-solidity/build/contracts/ERC20Mintable.json')
const addressBook = require('../../address-book.json')

const provider = new eth.providers.JsonRpcProvider(Cypress.env('provider'))
const wallet = eth.Wallet.fromMnemonic(Cypress.env('mnemonic')).connect(provider)
const origin = Cypress.env('publicUrl').substring(Cypress.env('publicUrl').indexOf('://')+3);
const tokenAddress = addressBook['4447'].Token.address.toLowerCase();
const token = new eth.Contract(tokenAddress, tokenArtifacts.abi, wallet);

const gasMoney = '0.005'

// Exported object, attach anything to this that you want available in tests
const my = {}

my.mnemonicRegex = /([A-Za-z]{3,}\s?){12}/
my.addressRegex = /.*0x[0-9a-z]{40}.*/i
my.xpubRegex = /^xpub[a-zA-Z0-9]{107}/i

////////////////////////////////////////
// Vanilla cypress compilations
// These functions behave a lot like cy.whatever functions

my.isStarting = () => cy.contains('span', /starting/i).should('exist')
my.doneStarting = () => cy.contains('span', /starting/i).should('not.exist')

my.goToDeposit = () => cy.get(`a[href="/deposit"]`).click()
my.goToSettings = () => cy.get(`a[href="/settings"]`).click()
my.goToRequest = () => cy.get(`a[href="/request"]`).click()
my.goToSend = () => cy.get(`a[href="/send"]`).click()
my.goToCashout = () => cy.get(`a[href="/cashout"]`).click()
my.goHome = () => cy.contains('button', /^home$/i).click()
my.goBack = () => cy.contains('button', /^back$/i).click()
my.goNextIntro = () => cy.contains('button', /^next$/i).click()
my.goCloseIntro = () => cy.contains('button', /^got it!$/i).click()

my.closeIntroModal = () => {
  my.isStarting()
  my.doneStarting()
  my.goNextIntro()
  my.goNextIntro()
  cy.contains('p', '??').should('not.exist')
  my.goCloseIntro()
  my.doneStarting()
}

my.burnCard = () => {
  my.goToSettings()
  cy.contains('button', /burn card/i).click()
  cy.contains('button', /burn$/i).click()
  cy.reload()
  my.isStarting()
  my.doneStarting()
}

my.restoreMnemonic = (mnemonic) => {
  my.goToSettings()
  cy.contains('button', /import/i).click()
  cy.get('input[type="text"]').clear().type(mnemonic)
  cy.get('button').find('svg').click()
  my.goBack()
  my.isStarting()
  my.doneStarting()
}

my.pay = (to, value) => {
  my.goToSend()
  cy.get('input[type="string"]').clear().type(to)
  cy.contains('p', /ignored for link/i).should('not.exist')
  cy.get('input[type="number"]').clear().type(value)
  cy.contains('button', /send/i).click()
  cy.contains('h5', /payment success/i).should('exist')
  cy.contains('button', /home/i).click()
}

my.cashoutEther = () => {
  my.goToCashout()
  cy.log(`cashing out to ${wallet.address}`)
  cy.get('input[type="text"]').clear().type(wallet.address)
  cy.contains('button', /cash out eth/i).click()
  cy.contains('span', /processing withdrawal/i).should('exist')
  cy.contains('span', /withdraw succeeded/i).should('exist')
  my.goBack()
  cy.resolve(my.getChannelTokenBalance).should('contain', '0.00')
}

my.cashoutToken = () => {
  my.goToCashout()
  cy.log(`cashing out to ${wallet.address}`)
  cy.get('input[type="text"]').clear().type(wallet.address)
  cy.contains('button', /cash out dai/i).click()
  cy.contains('span', /processing withdrawal/i).should('exist')
  cy.contains('span', /withdraw succeeded/i).should('exist')
  my.goBack()
  cy.resolve(my.getChannelTokenBalance).should('contain', '0.00')
}

////////////////////////////////////////
// Data handling & external promise functions

// Cypress needs control over the order things run in, so normal async/promises don't work right
// We need to return promise data by resolving a Cypress.Promise
// All promises, even Cypress ones, need to be wrapped in a `cy.wrap` for consistency

// If you want to assert against the return value of one of these & retry until it passes,
// use `cy.resolve` eg something like: `cy.resolve(my.function).should(blah)`
// but this won't work if my.function contains an assertion internally

my.getAddress = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    my.goToDeposit()
    cy.contains('button', my.addressRegex).invoke('text').then(address => {
      cy.log(`Got address: ${address}`)
      my.goBack()
      resolve(address)
    })
  }))
}

my.getMnemonic = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    my.goToSettings()
    cy.contains('button', my.mnemonicRegex).should('not.exist')
    cy.contains('button', /backup phrase/i).click()
    cy.contains('button', my.mnemonicRegex).should('exist')
    cy.contains('button', my.mnemonicRegex).invoke('text').then(mnemonic => {
      cy.log(`Got mnemonic: ${mnemonic}`)
      my.goBack()
      resolve(mnemonic)
    })
  }))
}

my.getXpub = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    my.goToRequest()
    cy.contains('button', my.xpubRegex).invoke('text').then(xpub => {
      cy.log(`Got xpub: ${xpub}`)
      my.goBack()
      resolve(xpub)
    })
  }))
}

my.getAccount = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    return my.getMnemonic().then(mnemonic => {
      return my.getAddress().then(address => {
        return my.getXpub().then(xpub => {
          return resolve({ address, mnemonic, xpub })
        })
      })
    })
  }))
}

my.getOnchainEtherBalance = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    return cy.wrap(wallet.provider.getBalance(wallet.address)).then(balance => {
      cy.log(`Onchain ether balance is ${balance.toString()} for ${wallet.address}`)
      resolve(balance.toString())
    })
  }))
}

my.getOnchainTokenBalance = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    return cy.wrap(token.balanceOf(wallet.address)).then(balance => {
      cy.log(`Onchain token balance is ${balance.toString()} for ${wallet.address}`)
      resolve(balance.toString())
    })
  }))
}

my.getChannelEtherBalance = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    cy.get('span#balance-channel-ether').invoke('text').then(balance => {
      cy.log(`Got ether balance: ${balance}`)
      resolve(balance.substring(1))
    })
  }))
}

my.getChannelTokenBalance = () => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    cy.get('span#balance-channel-token').invoke('text').then(balance => {
      cy.log(`Got token balance: ${balance}`)
      resolve(balance.substring(1))
    })
  }))
}

my.deposit = (value) => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    my.getAddress().then(address => {
      cy.log(`Depositing ${value} eth into channel ${address}`)
      return cy.wrap(wallet.sendTransaction({
        to: address,
        value: eth.utils.parseEther(value)
      })).then(tx => {
        return cy.wrap(wallet.provider.waitForTransaction(tx.hash)).then(() => {
          cy.contains('span', /processing deposit/i).should('exist')
          cy.contains('span', /processing swap/i).should('exist')
          cy.contains('span', /swap was successful/i).should('exist')
          cy.resolve(my.getChannelTokenBalance).should('not.contain', '0.00')
          my.getChannelTokenBalance().then(resolve)
        })
      })
    })
  }))
}

my.depositToken = (value) => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    my.getAddress().then(address => {
      cy.log(`Sending ${gasMoney} eth for gas money`)
      return cy.wrap(wallet.sendTransaction({
        to: address,
        value: eth.utils.parseEther(gasMoney)
      })).then(tx => {
        return cy.wrap(wallet.provider.waitForTransaction(tx.hash)).then(() => {
          cy.log(`Depositing ${value} tokens into channel ${address}`)
          return cy.wrap(token.transfer(
            address,
            eth.utils.parseEther(value).toHexString(),
          )).then(tx => {
            cy.log(`Waiting for tx ${tx.hash} to be mined...`)
            return cy.wrap(wallet.provider.waitForTransaction(tx.hash)).then(() => {
              cy.contains('span', /processing deposit/i).should('exist')
              cy.contains('span', /deposit confirmed/i).should('exist')
              cy.resolve(my.getChannelTokenBalance).should('not.contain', '0.00')
              my.getChannelTokenBalance().then(resolve)
            })
          })
        })
      })
    })
  }))
}

my.linkPay = (value) => {
  return cy.wrap(new Cypress.Promise((resolve, reject) => {
    my.goToSend()
    cy.get('input[type="number"]').clear().type(value)
    cy.contains('button', /link/i).click()
    cy.contains('button', origin).invoke('text').then(redeemLink => {
      cy.contains('button', /home/i).click()
      resolve(redeemLink)
    })
  }))
}

export default my
