import getCrossSection from './get-cross-section'
import debugMarker from './debug-marker'
import config from '../config'

// Sending data back to main thread is expensive. Don't send data too often and also try to distribute data
// among different messages, not to create one which would be very big (that's why offset is used).
const UPDATE_INTERVAL = {
  fields: 10,
  crossSection: 10
}
const UPDATE_OFFSET = {
  fields: 0,
  crossSection: 5
}
function shouldUpdate (name, stepIdx) {
  return (stepIdx + UPDATE_OFFSET[name]) % UPDATE_INTERVAL[name] === 0
}

function plateOutput (plate, props, stepIdx, forcedUpdate) {
  const result = {}
  result.id = plate.id
  result.quaternion = plate.quaternion
  result.angularVelocity = plate.angularVelocity
  result.hue = plate.hue
  result.density = plate.density
  if (props.renderHotSpots) {
    result.hotSpot = plate.hotSpot
  }
  if (forcedUpdate || shouldUpdate('fields', stepIdx)) {
    result.fields = {
      id: new Uint32Array(plate.size),
      elevation: new Float32Array(plate.size)
    }
    const fields = result.fields
    if (props.renderBoundaries) {
      fields.boundary = new Int8Array(plate.size)
    }
    if (props.renderForces) {
      fields.forceX = new Float32Array(plate.size)
      fields.forceY = new Float32Array(plate.size)
      fields.forceZ = new Float32Array(plate.size)
    }
    if (props.colormap === 'plate') {
      fields.originalHue = new Int16Array(plate.size)
    }
    let idx = 0
    plate.fields.forEach(field => {
      fields.id[idx] = field.id
      fields.elevation[idx] = field.elevation
      if (props.renderBoundaries) {
        fields.boundary[idx] = field.boundary
      }
      if (props.renderForces) {
        const force = field.force
        fields.forceX[idx] = force.x
        fields.forceY[idx] = force.y
        fields.forceZ[idx] = force.z
      }
      if (props.colormap === 'plate' && field.originalHue !== null) {
        // We can't pass null in Int16 array so use -1.
        fields.originalHue[idx] = field.originalHue !== null ? field.originalHue : -1
      }
      idx += 1
    })
  }
  return result
}

export default function modelOutput (model, props = {}, forcedUpdate) {
  if (!model) {
    return { stepIdx: 0, plates: [] }
  }
  const result = {}
  result.stepIdx = model.stepIdx
  result.debugMarker = debugMarker
  result.plates = model.plates.map(plate => plateOutput(plate, props, model.stepIdx, forcedUpdate))
  if (props.crossSectionPoint1 && props.crossSectionPoint2 && props.showCrossSectionView &&
     (forcedUpdate || shouldUpdate('crossSection', model.stepIdx))) {
    result.crossSection = {}
    const swap = props.crossSectionSwapped
    const p1 = props.crossSectionPoint1
    const p2 = props.crossSectionPoint2
    const p3 = props.crossSectionPoint3
    const p4 = props.crossSectionPoint4
    result.crossSection.dataFront = getCrossSection(model.plates, swap ? p2 : p1, swap ? p1 : p2)
    if (config.crossSection3d) {
      result.crossSection.dataRight = getCrossSection(model.plates, swap ? p1 : p2, swap ? p4 : p3)
      result.crossSection.dataBack = getCrossSection(model.plates, swap ? p4 : p3, swap ? p3 : p4)
      result.crossSection.dataLeft = getCrossSection(model.plates, swap ? p3 : p4, swap ? p2 : p1)
    }
  }
  return result
}
