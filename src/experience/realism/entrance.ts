import { BoxGeometry, CylinderGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3, type Material } from 'three'

/**
 * The villa's main entrance, recomposed.
 *
 * The purchased model had two candidates and neither worked: a decorative
 * timber panel left of the stone tower with solid plaster behind it, and a
 * glazed opening on the covered porch at the head of the main stair. The porch
 * is the natural way in — covered, framed by the tower and the east column,
 * directly above the stair — so that is where the front door now is: a tall
 * oak pivot door in a dark bronze portal, under a slim canopy with downlights.
 * The old timber panel becomes smoked glazing so nothing competes with it.
 */
const OPENING = { minX: 4.82, maxX: 6.2, minY: 3.82, maxY: 6.36, z: 15.76 }

export type EntranceMaterials = { door: Material; portal: Material; canopy: Material; led: Material; pull: Material }

export function buildEntrance(root: Object3D, materials: EntranceMaterials) {
  if (root.getObjectByName('KD_ENTRANCE')) return
  const group = new Object3D()
  group.name = 'KD_ENTRANCE'

  // The glazed leaf is replaced; its frame stays as the door's lining. The
  // planter that stood in front of that window would now block half the door.
  for (const name of ['Cube021_Glass_0', 'ARRIVAL_PLANTER', 'ARRIVAL_PLANTER_CAP', 'ARRIVAL_PLANTER_SOIL']) {
    root.getObjectByName(name)?.traverse((child) => { child.visible = false })
  }

  const width = OPENING.maxX - OPENING.minX
  const height = OPENING.maxY - OPENING.minY
  const cx = (OPENING.minX + OPENING.maxX) / 2

  const add = (geometry: BoxGeometry | CylinderGeometry, material: Material, x: number, y: number, z: number, name: string) => {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  }

  // Oak pivot leaf, set 4 cm behind the face so the portal casts onto it.
  add(new BoxGeometry(width - .04, height - .02, .07), materials.door, cx, OPENING.minY + height / 2, OPENING.z + .02, 'KD_DOOR_LEAF')
  // Full-height bronze pull, the one detail that says "front door".
  const pull = add(new CylinderGeometry(.022, .022, 1.55, 16), materials.pull, OPENING.minX + .28, OPENING.minY + 1.32, OPENING.z + .11, 'KD_DOOR_PULL')
  pull.castShadow = false

  // Dark bronze portal projecting 45 cm: jambs and head.
  const depth = .45
  const jamb = .2
  const portalZ = OPENING.z + depth / 2 - .02
  add(new BoxGeometry(jamb, height + .32, depth), materials.portal, OPENING.minX - jamb / 2, OPENING.minY + (height + .32) / 2 - .02, portalZ, 'KD_PORTAL_W')
  add(new BoxGeometry(jamb, height + .32, depth), materials.portal, OPENING.maxX + jamb / 2, OPENING.minY + (height + .32) / 2 - .02, portalZ, 'KD_PORTAL_E')
  add(new BoxGeometry(width + jamb * 2, .3, depth), materials.portal, cx, OPENING.maxY + .15, portalZ, 'KD_PORTAL_HEAD')

  // Slim white canopy over the landing, with two flush downlights.
  const canopyDepth = 1.7
  add(new BoxGeometry(width + 1.5, .1, canopyDepth), materials.canopy, cx, OPENING.maxY + .38, OPENING.z + canopyDepth / 2, 'KD_CANOPY')
  for (const dx of [-.5, .5]) {
    const lens = add(new CylinderGeometry(.06, .06, .012, 20), materials.led, cx + dx, OPENING.maxY + .325, OPENING.z + 1.05, 'KD_CANOPY_LENS')
    lens.castShadow = false
  }

  root.add(group)
}

/** Smoked glass on the old decorative timber panel. */
export function quietOldDoor(root: Object3D, material: Material) {
  const panel = root.getObjectByName('Cube018_Wood049_0')
  if (panel instanceof Mesh) panel.material = material
}

/**
 * A warm LED strip tucked under the nosing of every tread of the main stair
 * (instanced treads `Cube326`). By night they draw the way up to the door;
 * by day they are invisible.
 */
export function addStairLeds(root: Object3D, material: Material) {
  if (root.getObjectByName('KD_STAIR_LEDS')) return
  const treads = root.getObjectByName('Cube326')
  if (!(treads instanceof InstancedMesh)) return
  treads.geometry.computeBoundingBox()
  const local = treads.geometry.boundingBox!
  const matrix = new Matrix4()
  const world = new Matrix4()
  const corners = [new Vector3(), new Vector3()]
  const strips: Matrix4[] = []
  for (let index = 0; index < treads.count; index += 1) {
    treads.getMatrixAt(index, matrix)
    world.multiplyMatrices(treads.matrixWorld, matrix)
    corners[0].copy(local.min).applyMatrix4(world)
    corners[1].copy(local.max).applyMatrix4(world)
    const min = new Vector3().copy(corners[0]).min(corners[1])
    const max = new Vector3().copy(corners[0]).max(corners[1])
    const width = max.x - min.x
    const depth = max.z - min.z
    // Treads only: landings and caps are deeper than a going.
    if (depth > .6 || width < 1) continue
    strips.push(new Matrix4().compose(
      new Vector3((min.x + max.x) / 2, max.y - .05, max.z + .006),
      new Quaternion(),
      new Vector3(width - .24, 1, 1),
    ))
  }
  if (!strips.length) return
  const leds = new InstancedMesh(new BoxGeometry(1, .016, .018), material, strips.length)
  strips.forEach((strip, index) => leds.setMatrixAt(index, strip))
  leds.name = 'KD_STAIR_LEDS'
  leds.castShadow = false
  leds.receiveShadow = false
  root.add(leds)
}

export function makeEntranceMaterials(oakGrain: MeshStandardMaterial['map']): EntranceMaterials {
  const door = new MeshStandardMaterial({ name: 'KD_DOOR_OAK', color: '#9a7754', roughness: .48, metalness: 0, map: oakGrain ?? null })
  const portal = new MeshStandardMaterial({ name: 'KD_PORTAL_BRONZE', color: '#2f2a25', roughness: .38, metalness: .65 })
  const canopy = new MeshStandardMaterial({ name: 'KD_CANOPY_WHITE', color: '#ece8e1', roughness: .82, metalness: 0 })
  const led = new MeshStandardMaterial({ name: 'KD_LED', color: '#fff3df', emissive: '#ffcf8f', emissiveIntensity: 0, roughness: .4 })
  const pull = new MeshStandardMaterial({ name: 'KD_PULL_BRONZE', color: '#8b6a45', roughness: .28, metalness: 1 })
  led.userData.kdLed = true
  return { door, portal, canopy, led, pull }
}
