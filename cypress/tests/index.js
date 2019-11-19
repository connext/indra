import my from './utils'
import BN from 'bn.js'

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
        my.burnCard()
        my.deposit(depositEth).then(tokensDeposited => {
          my.linkPay(payTokens).then(redeemLink => {
            // TODO: has sender balance subtracted link amount?
            my.restoreMnemonic(recipientMnemonic)
            cy.visit(redeemLink)
            cy.contains('button', /redeem/i).click()
            cy.contains('button', /confirm/i).click()
            cy.contains('h5', /redeemed successfully/i).should('exist')
            cy.contains('button', /home/i).click()
            cy.resolve(my.getChannelTokenBalance).should('contain', payTokens)
          })
        })
      })
    })

    it(`Should display feedback if input is invalid`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        // No zero payments
        cy.get('input[type="numeric"]').clear().type('0')
        my.goToSend()
        cy.contains('p', /greater than 0/i).should('exist')
        my.goHome()
        // No payments greater than the card's balance
        cy.get('input[type="numeric"]').clear().type('1' + tokensDeposited)
        my.goToSend()
        cy.contains('p', /less than your balance/i).should('exist')
        my.goHome()
        // No invalid xpub addresses
        cy.get('input[type="text"]').clear().type('0xabc123')
        my.goToSend()
        cy.contains('p', /invalid/i).should('exist')
      })
    })

    it(`Should transfer tokens to an unopen daicard`, () => {
      my.getAccount().then(recipient => {
        my.burnCard()
        my.deposit(depositEth).then(tokensDeposited => {
          my.pay(recipient.xpub, payTokens)
          my.restoreMnemonic(recipient.mnemonic)
          cy.resolve(my.getChannelTokenBalance).should('contain', payTokens)
        })
      })
    })

  })

  describe('Request', () => {
    it(`Should properly populate the send page when opening a request link`, () => {
      // TODO: check xpub too (need to have xpub availabe somewhere to do this)
      my.goToRequest()
      cy.get('input[type="numeric"]').clear().type(payTokens)
      cy.contains('button', `amount=${payTokens}`).invoke('text').then(requestLink => {
        my.burnCard()
        cy.visit(requestLink)
        cy.get(`input[value="${payTokens}"]`).should('exist')
      })
    })
  })

  describe('Settings', () => {
    it(`Should restore the same address & balance after importing a mnemoic`, () => {
      my.getAccount().then(account => {
        my.deposit(depositEth).then(tokenDeposited => {
          my.burnCard()
          my.restoreMnemonic(account.mnemonic)
          cy.resolve(my.getChannelTokenBalance).should('contain', tokenDeposited)
          my.goToDeposit()
          cy.contains('button', my.addressRegex).invoke('text').should('eql', account.address)
        })
      })
    })
  })

  describe('Withdraw', () => {
    it(`Should withdraw eth to a valid address`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.getOnchainEtherBalance().then(balanceBefore => {
          my.cashoutEther()
          cy.resolve(my.getOnchainEtherBalance).should(balanceAfter => {
            expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore))
          })
        })
      })
    })

    it(`Should withdraw tokens to a valid address`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.getOnchainTokenBalance().then(balanceBefore => {
          my.cashoutToken()
          cy.resolve(my.getOnchainTokenBalance).should(balanceAfter => {
            expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore))
          })
        })
      })
    })

    it(`Should not withdraw to an invalid address`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.goToCashout()
        cy.get('input[type="text"]').clear().type('0xabc123')
        cy.contains('p', /invalid/i).should('exist')
      })
    })
  })
})
