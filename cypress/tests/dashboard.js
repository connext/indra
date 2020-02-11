import my from "./utils";
import BN from "bn.js";

describe('Dashboard', () => {
  beforeEach(() => {
    cy.visit(Cypress.env('publicUrl'))
  })
  describe('Debug', () => {
    it(`should navigate to debug screen`, () => {
      my.goToDebug()
    })
  })
})
