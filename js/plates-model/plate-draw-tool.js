import { random } from '../seedrandom'

const MAX_CONTINENTAL_CRUST_RATIO = 0.5
const MAX_DIST = 7
const SHELF_ELEVATION = 0.48
const SHELF_SLOPE = 0.15

function smoothAreaAroundShelves (shelfFields) {
  const queue = shelfFields
  const visited = {}
  const distance = {}
  const maxDistance = Math.ceil(SHELF_ELEVATION / SHELF_SLOPE)

  // Mark initial fields as visited
  queue.forEach(field => {
    visited[field.id] = true
    distance[field.id] = 0
  })

  while (queue.length > 0) {
    const field = queue.shift()
    const newDist = distance[field.id] + 1
    if (newDist < maxDistance) {
      field.forEachNeighbour(neigh => {
        if (!visited[neigh.id] && neigh.isOcean) {
          visited[neigh.id] = true
          distance[neigh.id] = newDist
          neigh.baseElevation = Math.max(SHELF_ELEVATION - newDist * SHELF_SLOPE, neigh.baseElevation)
          queue.push(neigh)
        }
      })
    }
  }
}

export default function plateDrawTool (plate, fieldId, type) {
  const plateSize = plate.size
  let continentSize = 0
  if (type === 'continent') {
    plate.fields.forEach(field => {
      if (field.continentalCrust) {
        continentSize += 1
      }
    })
    if ((continentSize + 1) / plateSize > MAX_CONTINENTAL_CRUST_RATIO) {
      return
    }
  }

  const shelf = new Set()
  const queue = []
  const visited = {}
  const distance = {}
  queue.push(plate.fields.get(fieldId))
  distance[fieldId] = 0
  visited[fieldId] = true

  while (queue.length > 0) {
    const field = queue.shift()
    if (type === 'continent' && field.isOcean) {
      continentSize += 1
    }
    field.type = type
    field.setDefaultProps()
    if (type === 'continent') {
      field.baseElevation += 0.1 * random()
    }
    // Make shape of continent a bit random, but keep eraser shape consistent.
    const newDistance = type === 'continent' ? distance[field.id] + 1 + 3 * random() : distance[field.id] + 2
    const continentAreaWithinLimit = type === 'ocean' || (continentSize + 1) / plateSize <= MAX_CONTINENTAL_CRUST_RATIO
    if (newDistance <= MAX_DIST && continentAreaWithinLimit) {
      field.forEachNeighbour(otherField => {
        if (!visited[otherField.id]) {
          visited[otherField.id] = true
          distance[otherField.id] = newDistance
          queue.push(otherField)
        }
        if (visited[otherField.id] && newDistance < distance[otherField.id]) {
          distance[otherField.id] = newDistance
        }
      })
    } else if (type === 'continent' && field.anyNeighbour(otherField => otherField.isOcean)) {
      // Continent drawing mode. The edge of the continent should have a bit lower elevation, so the transition
      // between ocean and continent is smooth.
      field.baseElevation = SHELF_ELEVATION
      shelf.add(field)
    } else if (type === 'ocean') {
      // Continent erasing mode. The same idea - making sure that the transition between ocean and continent is smooth.
      field.forEachNeighbour(otherField => {
        if (otherField.isContinent) {
          otherField.baseElevation = SHELF_ELEVATION
        }
      })
    }
  }

  smoothAreaAroundShelves(Array.from(shelf.values()))
}
