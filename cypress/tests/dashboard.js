/* global Cypress, cy */
import my from "./utils";

describe("Dashboard", () => {
  beforeEach(() => {
    cy.visit(Cypress.env("publicUrl"));
  });
  describe("Debug", () => {
    it("should navigate to debug screen", () => {
      my.goToDebug();
    });
  });
});
