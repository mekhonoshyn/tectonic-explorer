import getGrid from './grid'
import { serialize, deserialize } from '../utils'

const FOLDING_STRESS_FACTOR = 500000
const STRESS_SPREADING_FACTOR = 6

// Set of properties related to orogenesis. Used by Field instances.
export default class Orogeny {
  constructor (field) {
    this.field = field
    this.maxFoldingStress = 0
  }

  get serializableProps () {
    return [ 'maxFoldingStress' ]
  }

  serialize () {
    return serialize(this)
  }

  static deserialize (props, field) {
    return deserialize(new Orogeny(field), props)
  }

  setCollision (field) {
    this.calcFoldingStress(this.field.force)
    // This ensures that folding stress spreads nicely on both sides of the boundary.
    if (this.field.density > field.density && field.orogeny) {
      field.orogeny.setFoldingStress(this.maxFoldingStress)
    }
  }

  calcFoldingStress (force) {
    if (!force) return
    const stress = Math.min(1, force.length() * FOLDING_STRESS_FACTOR / this.field.area)
    this.setFoldingStress(stress)
  }

  setFoldingStress (foldingStress) {
    if (this.maxFoldingStress < foldingStress) {
      this.maxFoldingStress = foldingStress
      this.spreadFoldingStress()
    }
  }

  spreadFoldingStress () {
    const adjStress = this.maxFoldingStress - (getGrid().fieldDiameter * STRESS_SPREADING_FACTOR)
    if (adjStress < 0.1) return
    this.field.forEachNeighbour(field => {
      if (field.isOcean) return
      if (!field.orogeny) {
        field.orogeny = new Orogeny(field)
      }
      field.orogeny.setFoldingStress(adjStress)
    })
  }
}
