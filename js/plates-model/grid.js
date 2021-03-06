/* eslint-env serviceworker */
import Sphere from '../peels/sphere'
import config from '../config'
import VoronoiSphere from './voronoi-sphere'
import { toCartesian } from '../geo-utils'
import { kdTree } from 'kd-tree-javascript'
import c from '../constants'

// Overwrite constructor name, so standard-js doesn't print warnings...
const KdTree = kdTree

function dist (a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2))
}

class Grid {
  constructor () {
    this.sphere = new Sphere({ divisions: config.divisions })
    // firstVertex[field.id] returns index of the first vertex of given field.
    // Since both hexagons and pentagons are used, it's impossible to calculate it on the fly.
    this.firstVertex = {}
    this.processFields()
    this.fieldDiameter = this.calcFieldDiameter()
    this.fieldDiameterInKm = this.fieldDiameter * c.earthRadius
    // Note that kdTree will modify and reorder input array.
    this.kdTree = new KdTree(this.generateKDTreeNodes(), dist, ['x', 'y', 'z'])
    this.voronoiSphere = new VoronoiSphere(config.voronoiSphereFieldsCount, this.kdTree)
  }

  get size () {
    return this.fields.length
  }

  get fields () {
    return this.sphere.fields
  }

  get verticesCount () {
    // 6 vertices for each poly (-12 vertices for the 12 pentagons)
    return this.fields.length * 6 - 12
  }

  getFirstVertex (fieldId) {
    return this.firstVertex[fieldId]
  }

  // Pre-calculate additional information.
  processFields () {
    let c = 0
    this.fields.forEach(field => {
      field.localPos = toCartesian(field.position)
      field.adjacentFields = field._adjacentFields.map(f => f.id)
      // Populate firstVertex hash.
      this.firstVertex[field.id] = c
      c += field.adjacentFields.length
    })
  }

  calcFieldDiameter () {
    const field = this.fields[3]
    let distSum = 0
    field.adjacentFields.forEach(id => {
      const adjField = this.fields[id]
      distSum += field.localPos.distanceTo(adjField.localPos)
    })
    return distSum / field.adjacentFields.length
  }

  generateKDTreeNodes () {
    const fields = []
    this.fields.forEach(field => {
      const pos = field.localPos
      fields.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        id: field.id // index
      })
    })
    return fields
  }

  neighboursCount (fieldId) {
    return this.fields[fieldId].adjacentFields.length
  }

  nearestFields (point, count = 1) {
    return this.kdTree.nearest(point, count)
  }

  // point is expected to have .x, .y, .z properties.
  nearestFieldId (point) {
    if (config.optimizedCollisions) {
      // O(1), less accurate:
      return this.voronoiSphere.getNearestId(point)
    }
    // O(logn), accurate:
    return this.kdTree.nearest(point, 1)[0][0].id
  }

  getGeometryAttributes () {
    const transparent = { r: 0, g: 0, b: 0, a: 0 }
    let attributes
    // Actually it's fully synchronous function, but API is a bit overspoken.
    this.sphere.toCG({ colorFn: () => transparent, type: 'poly-per-field' }, (_err, _attributes) => {
      attributes = _attributes
    })
    return attributes
  }
}

let instance

export default function getGrid () {
  if (!instance) {
    instance = new Grid()
    self.g = instance
  }
  return instance
}
