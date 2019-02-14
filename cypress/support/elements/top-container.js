class TopContainer {
  getDrawContinents () {
    return cy.get('[data-test=Draw continents')
    // return cy.get('.interaction-selector > .large-button > .label').contains('Draw Continents');
  }

  getEraseContinents () {
    return cy.get('[data-test=Erase continents')
    // return cy.get('.interaction-selector > .large-button > .label').contains('Erase Continents');
  }

  getDrawCrossSection () {
    return cy.get('[data-test=Draw cross section')
    // return cy.get('.interaction-selector > .large-button > .label').contains('Draw cross section');
  }

  getDrawForceVector () {
    return cy.get('[data-test=Draw force vectors')
    // return cy.get('.interaction-selector > .large-button > .label').contains('Draw force vectors');
  }

  getRotateCamera () {
    return cy.get('[data-test=Rotate Camera')
    // return cy.get('.interaction-selector > .large-button > .label').contains('Rotate Camera');
  }

  getRefresh () {
    return cy.get('.top-bar--topBar--lXu1iRHL > .material-icons')
  }

  getShare () {
    return cy.get('.top-bar--share--181dZdzQ')
  }

  getAbout () {
    return cy.get('.top-bar--about--pqGn8uTf')
  }

  getResetCameraOrientation () {
    return cy.get('.planet-view > .camera-reset')
  }
}
export default TopContainer
