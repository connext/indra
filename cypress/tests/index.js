import my from './utils'
import BN from 'bn.js'

const depositEth = '0.05'
const depositToken = '5'
const payTokens = '3.14'
const botTransferAmount = '0.618' // Keep this synced w what recipient expects in ops/test-ui

// You can also hard-code this to the xpub for a daicard you have open in a separate browser
const recipientBot = 'xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK'

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
            cy.contains('span', /payment.* redeemed/i).should('exist')
            my.goBack()
            cy.resolve(my.getChannelTokenBalance).should('contain', payTokens)
          })
        })
      })
    })

    it(`Should display feedback if input is invalid`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.goToSend()
        // No zero payments
        cy.get('input[type="number"]').clear().type('0')
        cy.contains('p', /greater than 0/i).should('exist')
        // No payments greater than the card's balance
        cy.get('input[type="number"]').clear().type('1' + tokensDeposited)
        cy.contains('p', /less than your balance/i).should('exist')
        // No invalid xpub addresses
        cy.get('input[type="string"]').clear().type('0xabc123')
        cy.contains('p', /invalid recipient/i).should('exist')
      })
    })

    it(`Should transfer tokens to a collateralized payment bot`, () => {
      my.deposit(depositEth).then(tokensDeposited => {
        my.pay(recipientBot, botTransferAmount)
      })
    })

  })

  describe('Request', () => {
    it(`Should properly populate the send page when opening a request link`, () => {
      my.getXpub().then(xpub => {
        my.goToRequest()
        cy.get('input[type="number"]').clear().type(payTokens)
        cy.contains('button', `recipient=${xpub}`).should('exist')
        cy.contains('button', `amountToken=${payTokens}`).invoke('text').then(requestLink => {
          my.burnCard()
          cy.visit(requestLink)
          cy.get(`input[value="${payTokens}"]`).should('exist')
          cy.get(`input[value="${xpub}"]`).should('exist')
        })
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
