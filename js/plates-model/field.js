import getGrid from './grid'
import c from '../constants'
import config from '../config'
import FieldBase from './field-base'
import Subduction from './subduction'
import Orogeny from './orogeny'
import Earthquake from './earthquake'
import VolcanicEruption from './volcanic-eruption'
import VolcanicActivity from './volcanic-activity'
import { basicDrag, orogenicDrag } from './physics/forces'
import { serialize, deserialize } from '../utils'

// Max age of the field defines how fast the new oceanic crust cools down and goes from ridge elevation to its base elevation.
export const MAX_AGE = config.oceanicRidgeWidth / c.earthRadius
// When a continent is splitting apart along divergent boundary, its crust will get thinner and thinner
// until it reaches this value. Then the oceanic crust will be formed instead.
export const MIN_CONTINENTAL_CRUST_THICKNESS = 0.45

const FIELD_TYPE = {
  ocean: 0,
  continent: 1,
  island: 2
}
const FIELD_TYPE_NAME = Object.keys(FIELD_TYPE).reduce((res, key) => {
  res[FIELD_TYPE[key]] = key
  return res
}, {})
const ELEVATION = {
  ocean: 0.0,
  // sea level: 0.5
  continent: 0.55
}
// Adjust mass of the field, so simulation works well with given force values.
const MASS_MODIFIER = 0.000005

export default class Field extends FieldBase {
  constructor ({ id, plate, age = 0, type = 'ocean', elevation, crustThickness, originalHue, marked }) {
    super(id, plate)
    this.area = c.earthArea / getGrid().size // in km^2
    this.type = type
    this.age = age
    this.baseElevation = elevation !== undefined ? elevation : this.defaultElevation
    this.baseCrustThickness = crustThickness !== undefined ? crustThickness : this.defaultCrustThickness

    // Note that most properties use `undefined` as a falsy value (e.g. instead of `false` or `null`). Serialization
    // and deserialization automatically optimizes undefined values values, so the serialized model can be smaller.
    // So, it's better to use `undefined` for serializable properties whenever possible.

    this.boundary = undefined
    // Sometimes field can be moved from one plate to another (island-continent collision).
    // This info is used for rendering plate colors. For now, we need only color. If more properties should be
    // saved in the future, we should rethink this approach.
    this.originalHue = originalHue
    // Some fields can be marked. It seems to be view-specific property, but this marker can be transferred between
    // fields in some cases (e.g. island being squeezed into some continent).
    this.marked = marked

    // Geological properties.
    this.orogeny = undefined
    this.volcanicAct = undefined
    // An active & visible volcanic eruption, not just rising magma.
    this.volcanicEruption = undefined
    this.subduction = undefined
    this.trench = undefined
    this.earthquake = undefined
    // Used by adjacent fields only (see model.generateNewFields).
    this.noCollisionDist = undefined

    // Properties that are not serialized and can be derived from other properties and model state.
    this.alive = true // dead fields are immediately removed from plate
    this.draggingPlate = undefined // calculated during collision detection
    this.isContinentBuffer = false
    this.colliding = false
  }

  get serializableProps () {
    return [ 'id', 'boundary', 'age', '_type', 'baseElevation', 'baseCrustThickness', 'trench', 'earthquake', 'volcanicEruption', 'marked', 'noCollisionDist', 'originalHue' ]
  }

  serialize () {
    const props = serialize(this)
    props.orogeny = this.orogeny && this.orogeny.serialize()
    props.subduction = this.subduction && this.subduction.serialize()
    props.volcanicAct = this.volcanicAct && this.volcanicAct.serialize()
    props.earthquake = this.earthquake && this.earthquake.serialize()
    props.volcanicEruption = this.volcanicEruption && this.volcanicEruption.serialize()
    return props
  }

  static deserialize (props, plate) {
    const field = new Field({ id: props.id, plate })
    deserialize(field, props)
    field.orogeny = props.orogeny && Orogeny.deserialize(props.orogeny, field)
    field.subduction = props.subduction && Subduction.deserialize(props.subduction, field)
    field.volcanicAct = props.volcanicAct && VolcanicActivity.deserialize(props.volcanicAct, field)
    field.earthquake = props.earthquake && Earthquake.deserialize(props.earthquake, field)
    field.volcanicEruption = props.volcanicEruption && VolcanicEruption.deserialize(props.volcanicEruption)
    return field
  }

  clone () {
    const clone = Field.deserialize(this.serialize(), this.plate)
    clone.draggingPlate = this.draggingPlate
    return clone
  }

  set type (value) {
    this._type = FIELD_TYPE[value]
  }

  get type () {
    return FIELD_TYPE_NAME[this._type]
  }

  get isOcean () {
    return this._type === FIELD_TYPE.ocean
  }

  get isContinent () {
    return this._type === FIELD_TYPE.continent
  }

  get isIsland () {
    return this._type === FIELD_TYPE.island
  }

  get mass () {
    return MASS_MODIFIER * this.area * (this.continentalCrust ? config.continentDensity : config.oceanDensity)
  }

  get subductingFieldUnderneath () {
    // Volcanic activity happens on the overriding plate. Just check if it's still colliding with subducting plate.
    // Note that we can't use general .colliding property. volcanicAct.colliding will be set only when there's
    // collision with subducting plate, while the general .colliding property marks any collision.
    if (this.volcanicAct && this.volcanicAct.colliding && this.volcanicAct.colliding.subduction) {
      return this.volcanicAct.colliding
    }
    return null
  }

  get oceanicCrust () {
    return this.isOcean
  }

  get continentalCrust () {
    return this.isContinent || this.isIsland
  }

  get risingMagma () {
    return this.volcanicAct && this.volcanicAct.risingMagma
  }

  get force () {
    const force = basicDrag(this)
    if (this.draggingPlate) {
      force.add(orogenicDrag(this, this.draggingPlate))
    }
    return force
  }

  get torque () {
    return this.absolutePos.clone().cross(this.force)
  }

  get normalizedAge () {
    return Math.min(1, this.age / MAX_AGE)
  }

  get divergentBoundaryZone () {
    // Earthquakes should happen around the oceanic ridge.
    return this.normalizedAge < 0.5
  }

  get divergentBoundaryVolcanicZone () {
    // Volcanic eruptions should happen as close to the oceanic ridge as possible.
    return this.normalizedAge < 0.2
  }

  // range: [config.subductionMinElevation, 1]
  //  - [0, 1] -> [the deepest trench, the highest mountain]
  //  - 0.5 -> sea level
  //  - [config.subductionMinElevation, 0] -> subduction
  get elevation () {
    let modifier = 0
    if (this.isOcean) {
      if (this.subduction) {
        modifier = config.subductionMinElevation * this.subduction.progress
      } else if (this.normalizedAge < 1) {
        // age = 0 => oceanicRidgeElevation
        // age = 1 => baseElevation
        modifier = (config.oceanicRidgeElevation - this.baseElevation) * (1 - this.normalizedAge)
      }
    } else {
      modifier += this.mountainElevation
    }
    if (this.trench) {
      modifier = -1.5
    }
    return Math.min(1, this.baseElevation + modifier)
  }

  get mountainElevation () {
    if (this.continentalCrust) {
      const potentialVolcanicEruption = (this.volcanicAct && this.volcanicAct.value) || 0
      const mountain = (this.orogeny && this.orogeny.maxFoldingStress) || 0
      return 0.4 * Math.max(potentialVolcanicEruption, mountain)
    }
    return 0
  }

  get crustThickness () {
    if (this.trench) {
      return 0.1
    }
    if (this.isOcean) {
      return this.baseCrustThickness * this.normalizedAge
    } else {
      return this.baseCrustThickness + this.mountainElevation * 2 // mountain roots
    }
  }

  get crustCanBeStretched () {
    return this.isContinent && this.crustThickness > MIN_CONTINENTAL_CRUST_THICKNESS
  }

  get lithosphereThickness () {
    if (this.trench) {
      return 0.1
    }
    if (this.isOcean) {
      return 0.7 * this.normalizedAge
    }
    return 0.7
  }

  get defaultElevation () {
    return ELEVATION[this.type]
  }

  get defaultCrustThickness () {
    return this.type === 'ocean' ? 0.2 : this.baseElevation
  }

  setDefaultProps () {
    this.baseElevation = this.defaultElevation
    this.baseCrustThickness = this.defaultCrustThickness
    this.orogeny = undefined
    this.volcanicAct = undefined
    this.subduction = undefined
  }

  displacement (timestep) {
    return this.linearVelocity.multiplyScalar(timestep)
  }

  isBoundary () {
    // At least one adjacent field of this field is an adjacent field of the whole plate.
    for (let adjId of this.adjacentFields) {
      if (this.plate.adjacentFields.has(adjId)) {
        return true
      }
    }
    return false
  }

  isAdjacentField () {
    // At least one adjacent field of this field belongs to the plate.
    for (let adjId of this.adjacentFields) {
      if (this.plate.fields.has(adjId)) {
        return true
      }
    }
    return false
  }

  // Fields belonging to the parent plate.
  forEachNeighbour (callback) {
    for (let adjId of this.adjacentFields) {
      const field = this.plate.fields.get(adjId)
      if (field) {
        callback(field)
      }
    }
  }

  anyNeighbour (condition) {
    for (let adjId of this.adjacentFields) {
      const field = this.plate.fields.get(adjId)
      if (field && condition(field)) {
        return true
      }
    }
    return false
  }

  avgNeighbour (property) {
    let val = 0
    let count = 0
    for (let adjId of this.adjacentFields) {
      const field = this.plate.fields.get(adjId)
      if (field) {
        val += field[property]
        count += 1
      }
    }
    return val / count
  }

  // One of the neighbouring fields, pointed by linear velocity vector.
  neighbourAlongVector (direction) {
    const posOfNeighbour = this.absolutePos.clone().add(direction.clone().setLength(getGrid().fieldDiameter))
    return this.plate.fieldAtAbsolutePos(posOfNeighbour)
  }

  // Number of adjacent fields that actually belong to the plate.
  neighboursCount () {
    let count = 0
    for (let adjId of this.adjacentFields) {
      if (this.plate.fields.has(adjId)) {
        count += 1
      }
    }
    return count
  }

  get density () {
    return this.plate.density
  }

  performGeologicalProcesses (timestep) {
    if (this.subduction) {
      this.subduction.update(timestep)
      if (!this.subduction.active) {
        // Don't keep old subduction objects.
        this.subduction = undefined
      }
    }
    if (this.volcanicAct) {
      this.volcanicAct.update(timestep)
    }

    const trenchPossible = this.boundary && this.subductingFieldUnderneath && !this.orogeny
    if (this.trench && !trenchPossible) {
      // Remove trench when field isn't boundary anymore. Or when it collides with other continent and orogeny happens.
      this.trench = undefined
    }
    if (!this.trench && trenchPossible) {
      this.trench = true
    }

    if (this.earthquake) {
      this.earthquake.update(timestep)
      if (!this.earthquake.active) {
        // Don't keep old earthquake objects.
        this.earthquake = undefined
      }
    } else if (Earthquake.shouldCreateEarthquake(this)) {
      this.earthquake = new Earthquake(this)
    }

    if (this.volcanicEruption) {
      this.volcanicEruption.update(timestep)
      if (!this.volcanicEruption.active) {
        // Don't keep old volcanicEruption objects.
        this.volcanicEruption = undefined
      }
    } else if (VolcanicEruption.shouldCreateVolcanicEruption(this)) {
      this.volcanicEruption = new VolcanicEruption()
    }
    // Age is a travelled distance in fact.
    this.age += this.displacement(timestep).length()
  }

  resetCollisions () {
    this.colliding = false
    this.draggingPlate = undefined
    if (this.subduction) {
      this.subduction.resetCollision()
    }
    if (this.volcanicAct) {
      this.volcanicAct.resetCollision()
    }
  }
}
