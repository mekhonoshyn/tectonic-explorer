import generatePlates from './generate-plates';

export default class Model {
  constructor(preset) {
    this.plates = generatePlates(preset);
  }

  rotatePlates(delta = 1) {
    this.plates.forEach(plate => plate.rotate(delta));
  }

  handleCollisions() {
    this.plates.forEach(plate => plate.updateFields());
    // Detect collisions.
    this.plates.forEach(plate => {
      this.plates.forEach(otherPlate => {
        if (plate !== otherPlate) {
          plate.detectCollisionWith(otherPlate);
        }
      });
    });
  }
}
