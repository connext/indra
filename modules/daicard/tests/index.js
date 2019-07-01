import my from './utils'
import BN from 'bn.js'

const cy = global.cy
const Cypress = global.Cypress

const depositEth = '0.05'
const depositToken = '5'
const payTokens = '3.14'

describe('Daicard', () => {
  beforeEach(() => {
    cy.visit(Cypress.env('publicUrl'))
    my.closeIntroModal()
  })

  describe('Deposit', () => {
    it(`Should accept an Eth deposit to displayed address`, () => {
      my.deposit(depositEth)
    })

    it(`Should accept a token deposit to displayed address`, () => {
      my.depositToken(depositToken)
    })
  })

  describe('Send', (done) => {
    it(`Should send a payment when a link payment is opened in another card`, () => {
      my.getMnemonic().then(recipientMnemonic => {
        my.burnCard() // also decollateralizes the channel
        my.deposit(depositEth).then(tokensDeposited => {
          my.linkPay(payTokens).then(redeemLink => {
            my.restoreMnemonic(recipientMnemonic)
            cy.visit(redeemLink)
            cy.contains('span', /redeeming/i).should('exist')
            cy.contains('h5', /redeemed successfully/i).should('exist')
            cy.contains('p', payTokens).should('exist')
            my.goHome()
            cy.resolve(my.getChannelBalance).should('contain', payTokens)
          })
        })
      })
    })

    it(`Should not generate a payment link if the amount provided is invalid`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.goToSend()
        // No negative payments
        cy.get('input[type="number"]').clear().type('-1')
        cy.contains('button', /link/i).click()
        cy.contains('p', /above 0/i).should('exist')
        // No zero payments
        cy.get('input[type="number"]').clear().type('0')
        cy.contains('button', /link/i).click()
        cy.contains('p', /above 0/i).should('exist')
        // No payments greater than the card's balance
        cy.get('input[type="number"]').clear().type('1' + tokensDeposited)
        cy.contains('button', /link/i).click()
        cy.contains('p', /insufficient balance/i).should('exist')
      })
    })

    it(`Should not send a payment when input invalid`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.goToSend()
        cy.get('input[type="number"]').should('exist')
        // No negative numbers
        cy.get('input[type="number"]').clear().type('-1')
        cy.contains('button', /send/i).click()
        cy.contains('p', /above 0/i).should('exist')
        // No zero payments
        cy.get('input[type="number"]').clear().type('0')
        cy.contains('button', /send/i).click()
        cy.contains('p', /above 0/i).should('exist')
        // No payments above card's balance
        cy.get('input[type="number"]').clear().type('1' + tokensDeposited)
        cy.contains('button', /send/i).click()
        cy.contains('p', /insufficient balance/i).should('exist')
        // No invalid addresses
        cy.get('input[type="string"]').clear().type('0xabc123')
        cy.contains('button', /send/i).click()
        cy.contains('p', /invalid address/i).should('exist')
      })
    })

    // I don't think this is possible yet w/out the other card being online during payment
    it.skip(`Should send a payment to a card that has already been collateralized`, () => { })
  })

  describe('Request', () => {
    it(`Should properly populate the send page when opening a request link`, () => {
      my.getAddress().then(address => {
        my.goToReceive()
        cy.get('input[type="number"]').clear().type(payTokens)
        cy.contains('button', `recipient=${address}`).should('exist')
        cy.contains('button', `amountToken=${payTokens}`).invoke('text').then(requestLink => {
          my.burnCard()
          cy.visit(requestLink)
          cy.get(`input[value="${payTokens}"]`).should('exist')
          cy.get(`input[value="${address}"]`).should('exist')
        })
      })
    })

  })

  describe('Settings', () => {
    it(`Should provide an option for switching networks`, () => {
      my.goToSettings()
      cy.contains('div[role="button"]', /(mainnet)|(localhost)/i).click()
      cy.contains('li', /rinkeby/i).click()
      cy.contains('a[href="/settings"]', /rinkeby/i).should('exist')
      cy.contains('div[role="button"]', /rinkeby/i).click()
      cy.contains('li', /mainnet/i).click()
      cy.contains('a[href="/settings"]', /mainnet/i).should('exist')
    })

    it(`Should not decollateralize before burning an uncollateralized card`, () => {
      my.burnCard()
    })

    it(`Should restore the same address & balance after importing a mnemoic`, () => {
      my.getAccount().then(account => {
        my.deposit(depositEth).then(tokensDeposited => {
          my.burnCard()
          my.restoreMnemonic(account.mnemonic)
          cy.resolve(my.getChannelBalance).should('contain', tokensDeposited)
          my.goToDeposit()
          cy.contains('button', my.addressRegex).invoke('text').should('eql', account.address)
        })
      })
    })

  })

  describe('Withdraw', () => {
    it(`Should withdraw to a valid address`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.getOnchainBalance().then(balanceBefore => {
          my.cashout()
          cy.resolve(my.getOnchainBalance).should(balanceAfter => {
            expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore))
          })
        })
      })
    })

    it(`Should not withdraw to an invalid address`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.goToCashout()
        cy.get('input[type="text"]').clear().type('0xabc123')
        cy.contains('button', /cash out eth/i).click()
        cy.contains('p', /invalid/i).should('exist')
      })
    })

  })
})
