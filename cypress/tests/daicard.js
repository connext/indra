/* global Cypress, cy */
import my from "./utils";
import BN from "bn.js";

const depositEth = "0.05";
const depositToken = "5";
const payTokens = "3.14";

describe("Daicard", () => {
  beforeEach(() => {
    cy.visit(Cypress.env("publicUrl"));
    my.closeIntroModal();
  });

  describe("WalletConnext", () => {
    it(`should open a modal when activated`, () => {
      my.activateWalletConnext();
    });
  });

  describe("Deposit", () => {
    it(`should accept an Eth deposit to displayed address`, () => {
      my.deposit(depositEth);
    });
    it(`should accept a token deposit to displayed address`, () => {
      my.depositToken(depositToken);
    });
  });

  describe("Send", (done) => {
    it(`should send a payment when a link payment is opened in another card`, () => {
      my.getMnemonic().then((recipientMnemonic) => {
        my.burnCard();
        my.deposit(depositEth).then((tokensDeposited) => {
          my.linkPay(payTokens).then((redeemLink) => {
            // TODO: has sender balance subtracted link amount?
            my.restoreMnemonic(recipientMnemonic);
            cy.visit(redeemLink);
            cy.contains("button", /redeem/i).click();
            cy.contains("button", /confirm/i).click();
            cy.contains("h5", /redeemed successfully/i).should("exist");
            cy.contains("button", /home/i).click();
            cy.resolve(my.getChannelTokenBalance).should("contain", payTokens);
          });
        });
      });
    });

    it(`should display feedback if input is invalid`, () => {
      my.deposit(depositEth).then((tokensDeposited) => {
        my.goToSend();
        // No zero payments
        cy.get(`input[type="number"]`).clear().type("0");
        cy.contains("p", /greater than 0/i).should("exist");
        // No payments greater than the card's balance
        cy.get(`input[type="number"]`)
          .clear()
          .type("1" + tokensDeposited);
        cy.contains("p", /less than your balance/i).should("exist");
        // No invalid publicId addresses
        cy.get(`input[type="string"]`).clear().type("0xabc123");
        cy.contains("p", /invalid/i).should("exist");
      });
    });

    it(`should transfer tokens to an unopen daicard`, () => {
      my.getAccount().then((recipient) => {
        my.burnCard();
        my.deposit(depositEth).then((tokensDeposited) => {
          my.pay(recipient.publicId, payTokens);
          my.restoreMnemonic(recipient.mnemonic);
          cy.resolve(my.getChannelTokenBalance).should("contain", payTokens);
        });
      });
    });
  });

  describe("Request", () => {
    it(`should properly populate the send page when opening a request link`, () => {
      my.getPublicId().then((publicId) => {
        my.goToRequest();
        cy.get(`input[type="number"]`).clear().type(payTokens);
        cy.contains("button", `recipient=${publicId}`).should("exist");
        cy.contains("button", `amount=${payTokens}`)
          .invoke("text")
          .then((requestLink) => {
            my.burnCard();
            cy.visit(requestLink);
            cy.get(`input[value="${payTokens}"]`).should("exist");
            cy.get(`input[value="${publicId}"]`).should("exist");
          });
      });
    });
  });

  describe("Settings", () => {
    it(`should restore the same address & balance after importing a mnemoic`, () => {
      my.getAccount().then((account) => {
        my.deposit(depositEth).then((tokenDeposited) => {
          my.burnCard();
          my.restoreMnemonic(account.mnemonic);
          cy.resolve(my.getChannelTokenBalance).should("contain", tokenDeposited);
          my.goToDeposit();
          cy.contains("button", my.addressRegex).invoke("text").should("eql", account.address);
        });
      });
    });
  });

  describe("Withdraw", () => {
    it(`should withdraw eth to a valid address`, () => {
      my.deposit(depositEth).then((tokensDeposited) => {
        my.getOnchainEtherBalance().then((balanceBefore) => {
          my.cashoutEther();
          cy.resolve(my.getOnchainEtherBalance).should((balanceAfter) => {
            expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore));
          });
        });
      });
    });

    it(`should withdraw tokens to a valid address`, () => {
      my.deposit(depositEth).then((tokensDeposited) => {
        my.getOnchainTokenBalance().then((balanceBefore) => {
          my.cashoutToken();
          cy.resolve(my.getOnchainTokenBalance).should((balanceAfter) => {
            expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore));
          });
        });
      });
    });

    it(`should not withdraw to an invalid address`, () => {
      my.deposit(depositEth).then((tokensDeposited) => {
        my.goToCashout();
        cy.get(`input[type="string"]`).clear().type("0xabc123");
        cy.contains("p", /invalid/i).should("exist");
      });
    });
  });

  // Skipping because multisig's faulty replay protection causes this to fail
  // See point A2 of Heiko's audit for more info
  describe.skip("Withdraw then Deposit then Withdraw", () => {
    it(`should withdraw eth to a valid address the second time`, () => {
      my.deposit(depositEth).then((tokensDeposited) => {
        my.getOnchainEtherBalance().then((balanceBefore) => {
          my.cashoutEther();
          my.deposit(depositEth).then((tokensDeposited) => {
            my.getOnchainEtherBalance().then((balanceBefore) => {
              my.cashoutEther();
              cy.resolve(my.getOnchainEtherBalance).should((balanceAfter) => {
                expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore));
              });
            });
          });
        });
      });
    });

    it(`should withdraw tokens to a valid address the second time`, () => {
      my.depositToken(depositToken).then((tokensDeposited) => {
        my.getOnchainTokenBalance().then((balanceBefore) => {
          my.cashoutToken();
          my.depositToken(`${depositToken}.1`).then((tokensDeposited) => {
            my.getOnchainTokenBalance().then((balanceBefore) => {
              my.cashoutToken();
              cy.resolve(my.getOnchainTokenBalance).should((balanceAfter) => {
                expect(new BN(balanceAfter)).to.be.a.bignumber.greaterThan(new BN(balanceBefore));
              });
            });
          });
        });
      });
    });
  });
});
