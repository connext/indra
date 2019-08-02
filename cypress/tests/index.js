import my from './utils'
import BN from 'bn.js'

const depositEth = '0.05'
const depositToken = '5'
const payTokens = '3.14'

// hard-code this to the xpub for a daicard you have open in a separate browser
const externalRecipient = 'xpub6DnQdFpgotppbt8JmxdoqWpCgSgoPTjcPH2PjY65ya2jAia17yyZXHhei2Lw2m4nqZW5qYdvKVb65rWTynhRDvjGd6U8Tmp6hxV6YYTVWaF'

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
    it.skip(`Should send a payment when a link payment is opened in another card`, () => {
      my.getMnemonic().then(recipientMnemonic => {
        my.burnCard() // also decollateralizes the channel
        my.deposit(depositEth).then(ethDeposited => {
          my.linkPay(payTokens).then(redeemLink => {
            my.restoreMnemonic(recipientMnemonic)
            cy.visit(redeemLink)
            cy.contains('span', /redeeming/i).should('exist')
            cy.contains('h5', /redeemed successfully/i).should('exist')
            cy.contains('p', payTokens).should('exist')
            my.goHome()
            cy.resolve(my.getChannelEtherBalance).should('contain', payTokens)
          })
        })
      })
    })

    it(`Should display feedback if input is invalid`, () => {
      my.deposit(depositEth).then(ethDeposited => {
        my.goToSend()
        // No zero payments
        cy.get('input[type="number"]').clear().type('0')
        cy.contains('p', /greater than 0/i).should('exist')
        // No payments greater than the card's balance
        cy.get('input[type="number"]').clear().type('1' + ethDeposited)
        cy.contains('p', /less than your balance/i).should('exist')
        // No invalid xpub addresses
        cy.get('input[type="string"]').clear().type('0xabc123')
        cy.contains('p', /invalid recipient/i).should('exist')
      })
    })

    it.skip(`Should send a payment to a card that has already been collateralized`, () => {
      my.deposit(depositEth).then(ethDeposited => {
        my.pay(externalRecipient, '0.01')
      })
    })
  })

  describe('Request', () => {
    it(`Should properly populate the send page when opening a request link`, () => {
      my.getAddress().then(address => {
        my.goToRequest()
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
    it(`Should restore the same address & balance after importing a mnemoic`, () => {
      my.getAccount().then(account => {
        my.deposit(depositEth).then(ethDeposited => {
          my.burnCard()
          my.restoreMnemonic(account.mnemonic)
          cy.resolve(my.getChannelEtherBalance).should('contain', ethDeposited)
          my.goToDeposit()
          cy.contains('button', my.addressRegex).invoke('text').should('eql', account.address)
        })
      })
    })
  })

  describe('Withdraw', () => {
    it(`Should withdraw to a valid address`, () => {
      my.deposit(depositEth).then(ethDeposited => {
        my.getOnchainBalance().then(balanceBefore => {
          my.cashout()
          cy.resolve(my.getOnchainBalance).should(balanceAfter => {
            expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore))
          })
        })
      })
    })

    it(`Should not withdraw to an invalid address`, () => {
      my.deposit(depositEth).then(ethDeposited => {
        my.goToCashout()
        cy.get('input[type="text"]').clear().type('0xabc123')
        cy.contains('p', /invalid/i).should('exist')
      })
    })
  })
})
