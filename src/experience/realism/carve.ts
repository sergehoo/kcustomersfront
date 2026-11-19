import { Box3, BoxGeometry, BufferAttribute, InstancedMesh, Matrix4, Mesh, Vector3, type Material, type Object3D } from 'three'

/**
 * The upper storey was built in Blender inside the purchased villa, whose own
 * partitions and doors were left in place. They cut straight through the new
 * master bathroom — a door 50 cm in front of the lens and a plaster fin across
 * the vanity — which is why that room could never be framed.
 *
 * This removes, at load time, only what of the original model lies entirely
 * inside a room's volume: triangles of the merged wall mesh, door instances and
 * a stray window. The rooms' own walls (`W_*`, `BATH_*`) are never touched.
 */
const ORIGINAL = /^(Plane_Plaster_0|Door_|Cube020_)/

const corner = new Vector3()
const matrix = new Matrix4()

export function carveRoom(root: Object3D, room: Box3) {
  root.updateMatrixWorld(true)
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !ORIGINAL.test(child.name)) return
    if (child instanceof InstancedMesh) {
      let changed = false
      for (let index = 0; index < child.count; index += 1) {
        child.getMatrixAt(index, matrix)
        corner.setFromMatrixPosition(matrix).applyMatrix4(child.matrixWorld)
        if (!room.containsPoint(corner)) continue
        matrix.makeScale(0, 0, 0)
        child.setMatrixAt(index, matrix)
        changed = true
      }
      if (changed) child.instanceMatrix.needsUpdate = true
      return
    }
    const geometry = child.geometry
    const key = `kdCarved:${room.min.toArray().join(',')}`
    if (geometry.userData[key]) return
    geometry.userData[key] = true
    const position = geometry.getAttribute('position')
    const index = geometry.getIndex()
    const count = index ? index.count : position.count
    const keep: number[] = []
    const world = (vertex: number) => corner.fromBufferAttribute(position, vertex).applyMatrix4(child.matrixWorld)
    const centroid = new Vector3()
    let removed = 0
    for (let i = 0; i < count; i += 3) {
      const a = index ? index.getX(i) : i
      const b = index ? index.getX(i + 1) : i + 1
      const c = index ? index.getX(i + 2) : i + 2
      // Centroid, not all three corners: the old partitions run floor to
      // ceiling, so their corners sit a few centimetres outside the room volume.
      centroid.copy(world(a)).add(world(b)).add(world(c)).multiplyScalar(1 / 3)
      if (room.containsPoint(centroid)) { removed += 1; continue }
      keep.push(a, b, c)
    }
    if (!removed) return
    if (!index && keep.length === count) return
    geometry.setIndex(new BufferAttribute(position.count > 65535 ? new Uint32Array(keep) : new Uint16Array(keep), 1))
  })
}

/** A plain plaster ceiling over a room, in the material of one of its walls. */
export function addCeiling(root: Object3D, materialFrom: string, room: Box3, height: number) {
  const name = `KD_CEILING_${materialFrom}`
  if (root.getObjectByName(name)) return
  const source = root.getObjectByName(materialFrom)
  if (!(source instanceof Mesh)) return
  const width = room.max.x - room.min.x + .3
  const depth = room.max.z - room.min.z + .3
  const ceiling = new Mesh(new BoxGeometry(width, .06, depth), source.material as Material)
  ceiling.name = name
  ceiling.position.set((room.min.x + room.max.x) / 2, height + .03, (room.min.z + room.max.z) / 2)
  ceiling.castShadow = true
  ceiling.receiveShadow = true
  root.add(ceiling)
}

/**
 * Replaces a straight partition with a wall that keeps a door opening at one
 * end, plus a lintel. Coordinates are world space along z (the partitions run
 * north–south); the replacement reuses the wall's own material.
 */
export function openDoorway(root: Object3D, wallName: string, opening: { fromZ: number; toZ: number; height: number }) {
  const wall = root.getObjectByName(wallName)
  if (!(wall instanceof Mesh) || wall.userData.kdDoorway) return
  wall.userData.kdDoorway = true
  wall.updateWorldMatrix(true, false)
  wall.geometry.computeBoundingBox()
  const box = wall.geometry.boundingBox!.clone().applyMatrix4(wall.matrixWorld)
  const material = wall.material as Material
  const x = (box.min.x + box.max.x) / 2
  const thickness = box.max.x - box.min.x
  const pieces: [number, number, number, number][] = []
  // [zFrom, zTo, yFrom, yTo]
  if (opening.fromZ > box.min.z) pieces.push([box.min.z, opening.fromZ, box.min.y, box.max.y])
  if (opening.toZ < box.max.z) pieces.push([opening.toZ, box.max.z, box.min.y, box.max.y])
  pieces.push([opening.fromZ, opening.toZ, box.min.y + opening.height, box.max.y])
  for (const [z0, z1, y0, y1] of pieces) {
    const piece = new Mesh(new BoxGeometry(thickness, y1 - y0, z1 - z0), material)
    piece.name = `${wallName}_KD_PIECE`
    piece.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2)
    piece.castShadow = wall.castShadow
    piece.receiveShadow = true
    root.add(piece)
  }
  wall.visible = false
}
