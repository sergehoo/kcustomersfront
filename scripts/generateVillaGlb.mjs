import { mkdir, writeFile } from 'node:fs/promises'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

class FileReaderPolyfill {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((value) => { this.result = value; this.onloadend?.() }) }
}
globalThis.FileReader = FileReaderPolyfill

const villa = new THREE.Group()
villa.name = 'KaydanVilla'
const material = (name, color, roughness = .65, metalness = 0) => {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  value.name = name
  return value
}
const m = {
  ivory: material('stone_travertine', '#e8e0d2', .9), travertine: material('stone_travertine', '#cdb994', .84), plaster: material('plaster_ivoire', '#eee9df', .96), oak: material('oak_wood', '#75482d', .56), darkOak: material('oak_wood', '#3e2c20', .62), bronze: material('bronze_metal', '#4d4030', .26, .86), charcoal: material('charcoal_metal', '#242321', .35, .72), textile: material('boucle_textile', '#d5cabd', .92), water: material('pool_water', '#75b9c0', .14, .22), foliage: material('foliage', '#345640', .9), trunk: material('tropical_trunk', '#4b3222', 1), glass: new THREE.MeshPhysicalMaterial({ name: 'architectural_glass', color: '#bcd8d9', roughness: .04, metalness: .08, transparent: true, opacity: .36, transmission: .22, side: THREE.DoubleSide }),
}
function mesh(geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0], name = '') { const object = new THREE.Mesh(geometry, mat); object.position.set(...position); object.rotation.set(...rotation); object.castShadow = true; object.receiveShadow = true; object.name = name; villa.add(object); return object }
function box(size, mat, position, name = '') { return mesh(new THREE.BoxGeometry(...size), mat, position, [0, 0, 0], name) }
function rounded(size, mat, position, radius = .08, name = '') { return mesh(new RoundedBoxGeometry(...size, 5, radius), mat, position, [0, 0, 0], name) }
function cylinder(radiusTop, radiusBottom, height, mat, position, name = '') { return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24), mat, position, [0, 0, 0], name) }
function floor(width, depth, x, z, mat = m.ivory) { rounded([width, .14, depth], mat, [x, .07, z], .035, 'Stone floor') }
function wall(width, height, depth, x, z, mat = m.plaster) { box([width, height, depth], mat, [x, height / 2, z], 'Architectural wall') }
function glassWall(width, height, x, z, rotation = 0) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation; group.name = 'Full-height glazing'; villa.add(group)
  const add = (geometry, mat, position) => { const object = new THREE.Mesh(geometry, mat); object.position.set(...position); object.castShadow = true; object.receiveShadow = true; group.add(object) }
  add(new THREE.PlaneGeometry(width, height), m.glass, [0, height / 2, 0]);
  add(new THREE.BoxGeometry(width + .14, .12, .15), m.charcoal, [0, .06, .03]); add(new THREE.BoxGeometry(width + .14, .12, .15), m.charcoal, [0, height - .06, .03]);
  for (const i of [-width / 2, 0, width / 2]) add(new THREE.BoxGeometry(.1, height, .14), m.charcoal, [i, height / 2, .03]);
}
function beams(x, z, width, depth) { for (let i = 0; i < 17; i++) box([.13, .14, depth], m.oak, [x - width / 2 + .22 + i * ((width - .44) / 16), 4.62, z], 'Timber ceiling slat') }
function sofa(x, z, rotation = 0) { const g = new THREE.Group(); g.name = 'Deep lounge sofa'; g.position.set(x, 0, z); g.rotation.y = rotation; villa.add(g); const add = (size, pos, mat, r = .1) => { const o = new THREE.Mesh(new RoundedBoxGeometry(...size, 5, r), mat); o.position.set(...pos); o.castShadow = true; o.receiveShadow = true; g.add(o) }; add([3.4,.72,1.05],[0,.54,0],m.textile); add([3.42,.56,.22],[0,1.05,.4],m.textile); add([.22,.72,1.05],[-1.6,.57,0],m.textile); add([.22,.72,1.05],[1.6,.57,0],m.textile) }
function coffeeTable(x, z) { cylinder(.82, .82, .12, m.oak, [x, .5, z], 'Solid wood coffee table'); cylinder(.12, .18, .5, m.bronze, [x, .24, z], 'Coffee table pedestal') }
function chair(x, z, rotation = 0) { const g = new THREE.Group(); g.name = 'Outdoor lounge chair'; g.position.set(x, 0, z); g.rotation.y = rotation; villa.add(g); const add = (size, pos, mat, r = .08) => { const o = new THREE.Mesh(new RoundedBoxGeometry(...size, 5, r), mat); o.position.set(...pos); o.castShadow = true; o.receiveShadow = true; g.add(o) }; add([.9,.18,.9],[0,.7,0],m.textile); add([.9,.72,.14],[0,1.2,.36],m.textile); for(const [a,b] of [[-.33,-.32],[.33,-.32],[-.33,.32],[.33,.32]]) { const leg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.7,8),m.bronze);leg.position.set(a,.34,b);g.add(leg) } }
function pendant(x, z) { cylinder(.025,.025,1.35,m.bronze,[x,4.25,z],'Pendant cable'); mesh(new THREE.SphereGeometry(.23,24,24),new THREE.MeshStandardMaterial({color:'#e5ba78',emissive:'#be7424',emissiveIntensity:1.25,roughness:.25}),[x,3.53,z],[0,0,0],'Pendant lamp') }
function planter(x,z,scale=1) { rounded([1.25,.55,.72],m.charcoal,[x,.3,z],.08,'Planter'); cylinder(.11,.16,2.5,m.trunk,[x,1.75,z],'Palm trunk'); for(let i=0;i<8;i++){const leaf=mesh(new THREE.ConeGeometry(.34,2.1,5,1,true),m.foliage,[x,2.9,z],[.22+(i%2)*.14,i*.78,0],'Palm leaf'); leaf.rotation.x=.2+(i%2)*.16; leaf.scale.setScalar(scale)} }
function bed(x,z) { rounded([3.7,.38,2.35],m.darkOak,[x,.44,z],.11,'Low king bed frame'); rounded([3.5,.42,2.15],m.textile,[x,.78,z],.14,'King mattress'); rounded([3.5,1.15,.22],m.oak,[x,1.4,z+1.02],.05,'Wood headboard'); for(const dx of [-.9,.9]) rounded([1.15,.14,.5],m.textile,[x+dx,1.12,z+.47],.09,'Pillow') }
function bath(x,z) { const tub=mesh(new THREE.CapsuleGeometry(.68,2.3,10,24),m.plaster,[x,.76,z],[0,0,Math.PI/2],'Freestanding bath'); tub.scale.z=1.25; cylinder(.035,.05,1.05,m.bronze,[x+1.45,.57,z],'Minimal tap'); box([.05,.05,.58],m.bronze,[x+1.45,1.08,z-.25],'Minimal faucet') }
function stair(x,z) { for(let i=0;i<11;i++) box([3.3,.18,.55],m.travertine,[x,.09+i*.18,z-i*.5],'Travertine stair'); glassWall(5.4,1.4,x+1.78,z-2.2,Math.PI/2) }
function ceiling(width,depth,x,z) { box([width,.18,depth],m.plaster,[x,4.72,z],'Floating ceiling') }

// Shared villa shell: open, bright, natural materials and continuous circulation.
floor(19,36,0,-1.5,m.travertine); wall(.32,5,36,-9,-1.5,m.plaster); wall(.32,5,36,9,-1.5,m.plaster); wall(18.2,5,.32,0,15.5,m.plaster); wall(18.2,5,.32,0,-18.5,m.plaster)
floor(8.8,8.8,0,10.8); glassWall(8.3,4.6,0,15.3); beams(0,11.2,8.5,7.8); chair(-2.7,11.3,.25); chair(.25,11.3,-.15); coffeeTable(-1.25,10.25); planter(-7.9,13.1,.8); planter(7.8,12.2,.9)
floor(12,8.4,-1,2.5); ceiling(12,8.4,-1,2.5); glassWall(7.8,4.6,8.78,2.5,Math.PI/2); sofa(-3,1.4,-.12); sofa(1.1,2.2,2.85); coffeeTable(-.7,1.2); chair(-5.3,4.7,-.3); pendant(-1,1.9); pendant(1.2,1.9); pendant(3.4,1.9)
// Bar and kitchen visible from the principal salon.
rounded([4.3,1.05,.9],m.oak,[3.1,.57,5.15],.08,'Kitchen island'); rounded([4.55,.14,1.06],m.travertine,[3.1,1.15,5.15],.04,'Stone island top'); for(let i=0;i<4;i++) chair(1.8+i*.88,4.18,Math.PI)
floor(5.7,7.3,-4.9,-5.1); ceiling(5.7,7.3,-4.9,-5.1); wall(.22,5,7.2,-2.1,-5.1,m.travertine); bed(-5.1,-5.4); glassWall(5.2,4.6,-7.75,-5.1,-Math.PI/2); planter(-7.55,-8.2,.5)
floor(5.4,5.7,3.7,-7.3); ceiling(5.4,5.7,3.7,-7.3); wall(.22,5,5.7,1,-7.3,m.plaster); bath(3.65,-7.3); glassWall(5,4.6,6.35,-7.3,Math.PI/2); pendant(3.7,-6.9)
floor(7.5,7.1,-.3,-12.5); ceiling(7.5,7.1,-.3,-12.5); stair(-.45,-9.8); glassWall(6.5,4.6,-8.77,-12.5,-Math.PI/2); wall(5.2,5,.22,5,-12.5,m.travertine)
floor(12.4,6.1,1.4,-16); beams(1.4,-16,11.7,5.6); glassWall(8.2,4.6,4.2,-18.25); sofa(-1.8,-16.2,Math.PI); sofa(2.3,-14.9,2.7); coffeeTable(.2,-16); chair(-4.5,-14.8,1.15); planter(7.7,-16.6,.8)
// Final terrace, horizon side kept intentionally open.
floor(18,7.5,0,-23,m.travertine); beams(0,-23,15.5,6.8); sofa(-2.6,-23,0); sofa(2.2,-23,Math.PI); coffeeTable(-.2,-23); for(const x of [-7.5,7.5]) planter(x,-24.8,1.15); glassWall(17.2,1.25,0,-26.6)

const exporter = new GLTFExporter()
const glb = await new Promise((resolve, reject) => exporter.parse(villa, resolve, reject, { binary: true, onlyVisible: true, truncateDrawRange: true }))
await mkdir(new URL('../public/models/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/models/kaydan-villa.glb', import.meta.url), new Uint8Array(glb))
console.log('Generated public/models/kaydan-villa.glb')
