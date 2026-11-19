"""Reworks the villa's large volumes after `restructure_front.py`.

The access, stair, landing and door are validated and untouched here. What
remained of the purchased model — a 0.8 m slab-and-upstand hanging over the
porch, a 2 m roof overhang read edge-on, a blind east wall, a timber-effect
garage door, railings in three different styles — is replaced by one
contemporary language:

* a deep white frame around the main upper volume (0.97 m lintel, side jambs,
  a 22 cm balcony slab), projecting to z 19.0 so the curtain wall, the stone
  tower and the upper glazing sit 2–3 m back in its shadow;
* a frameless glass balcony inside it, on a thin anthracite shoe and rail;
* every remaining railing restyled to clear glass with an anthracite profile;
* tall glazed openings and an oak screen on the east wall;
* a slatted bronze garage door with a lit lintel.

It also moves into the model what the browser used to patch at load time on
the upper floor: the purchased model's partitions and door inside the master
bathroom are removed, the suite and the bathroom get real doorways off the
landing, and the bathroom gets its ceiling.

Run after `restructure_front.py`, in the same session or on its output:
    blender -b <pre-restructuring blend> \\
        --python blender/scripts/restructure_front.py \\
        --python blender/scripts/restructure_volumes.py

Coordinates are glTF/Three.js (x, y up, z towards the road), written to
Blender as (x, -z, y).
"""

import os
import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND_OUTPUT = os.path.join(ROOT, 'blender', 'kaydan-villa-production.blend')
GLB_OUTPUT = os.path.join(ROOT, 'assets-source', 'models', 'kaydan-villa-production.glb')

# The main upper volume, measured by ray-casting the production blend.
FRAME_X0, FRAME_X1 = -2.95, 7.15
FRAME_FRONT, FRAME_BACK = 19.0, 15.8
SLAB_Y0, SLAB_Y1 = 6.80, 7.02          # porch soffit stays at 6.80
LINTEL_Y0, LINTEL_Y1 = 9.88, 10.85     # wraps the old roof edge (10.0–10.62)
JAMB = .30

BATHROOM = ((-7.9, -2.02), (6.95, 9.55), (12.42, 15.83))
STAIR_BAY = (-.15, 1.75, 16.85)        # x0, x1, front of the stair's half landing


def B(x, y, z):
    return Vector((x, -z, y))


def material(name, base, roughness, metallic=0.0, emission=None, strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return mat


def existing(name, fallback):
    return bpy.data.materials.get(name) or (fallback() if callable(fallback) else fallback)


RENDER = existing('KAYDAN_RENDER_WHITE', lambda: material('KAYDAN_RENDER_WHITE', (.86, .84, .80), .82))
GLASS = existing('Glass', lambda: material('Glass', (.9, .9, .9), .02))
TINTED = existing('KAYDAN_TINTED_GLASS', lambda: material('KAYDAN_TINTED_GLASS', (.18, .2, .21), .04))
ENTRY_GLASS = existing('KAYDAN_ENTRY_GLASS', lambda: material('KAYDAN_ENTRY_GLASS', (.06, .065, .07), .12, .3))
FRAME = existing('KAYDAN_ENTRY_FRAME', lambda: material('KAYDAN_ENTRY_FRAME', (.10, .085, .07), .38, .7))
RAIL = material('KAYDAN_RAIL_ANTHRACITE', (.045, .047, .05), .35, .8)
BRONZE = existing('KAYDAN_BRONZE', lambda: material('KAYDAN_BRONZE', (.36, .27, .18), .3, 1.))
OAK = existing('KAYDAN_DOOR_OAK', lambda: material('KAYDAN_DOOR_OAK', (.42, .30, .19), .48))
LED = existing('KAYDAN_LED', lambda: material('KAYDAN_LED', (1, .93, .82), .4, emission=(1, .78, .52), strength=3.0))
LENS = existing('KAYDAN_LENS_WARM', LED)
UPPER_PLASTER = existing('KAYDAN_UPPER_PLASTER', RENDER)
DRIVE = existing('KAYDAN_DRIVE', lambda: material('KAYDAN_DRIVE', (.42, .40, .37), .8))

REPORT = []
NEW = None


def collection(name):
    coll = bpy.data.collections.get(name)
    if coll:
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        return coll
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def world_uvs(bm):
    uv = bm.loops.layers.uv.active or bm.loops.layers.uv.new()
    bm.normal_update()
    for face in bm.faces:
        n = face.normal
        for loop in face.loops:
            co = loop.vert.co
            loop[uv].uv = (co.x, co.y) if abs(n.z) > .5 else (co.y, co.z) if abs(n.x) > .5 else (co.x, co.z)


def link(name, bm, mat):
    world_uvs(bm)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    NEW.objects.link(obj)
    return obj


def _cube(bm, x0, x1, y0, y1, z0, z1):
    matrix = Matrix.LocRotScale(B((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), None, (x1 - x0, z1 - z0, y1 - y0))
    bmesh.ops.create_cube(bm, size=1.0, matrix=matrix, calc_uvs=True)


def box(name, x0, x1, y0, y1, z0, z1, mat):
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    _cube(bm, x0, x1, y0, y1, z0, z1)
    return link(name, bm, mat)


def boxes(name, bounds, mat):
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    for b in bounds:
        _cube(bm, *b)
    return link(name, bm, mat)


def centre(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(c.x for c in corners) / 8, sum(c.z for c in corners) / 8, -sum(c.y for c in corners) / 8


def remove(name):
    obj = bpy.data.objects.get(name)
    if obj:
        REPORT.append(f'removed {name}')
        bpy.data.objects.remove(obj, do_unlink=True)


def delete_faces(name, predicate):
    obj = bpy.data.objects.get(name)
    if obj is None:
        return
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    world = obj.matrix_world
    doomed = [f for f in bm.faces if predicate(*(lambda c: (c.x, c.z, -c.y))(world @ f.calc_center_median()))]
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    REPORT.append(f'{name}: {len(doomed)} faces removed')


def cut_opening(name, x0, x1, y0, y1, z0, z1):
    """Cuts a clean rectangular opening through a merged wall mesh: the faces
    around the box are bisected on its edges first, so the deletion stops on
    straight lines instead of taking whole wall-sized faces with it."""
    obj = bpy.data.objects.get(name)
    if obj is None:
        return
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    world = obj.matrix_world
    inverse = world.inverted()
    normal_to_local = world.to_3x3().transposed()
    bm = bmesh.new()
    bm.from_mesh(obj.data)

    def near():
        out = []
        for face in bm.faces:
            g = [(lambda v: (v.x, v.z, -v.y))(world @ v.co) for v in face.verts]
            if all(min(p[k] for p in g) <= hi and max(p[k] for p in g) >= lo for k, (lo, hi) in enumerate(((x0, x1), (y0, y1), (z0, z1)))):
                out.append(face)
        return out

    for point, normal in ((B(x0, 0, 0), Vector((1, 0, 0))), (B(x1, 0, 0), Vector((1, 0, 0))),
                          (B(0, y0, 0), Vector((0, 0, 1))), (B(0, y1, 0), Vector((0, 0, 1)))):
        faces = near()
        edges = list({e for f in faces for e in f.edges})
        verts = list({v for f in faces for v in f.verts})
        bmesh.ops.bisect_plane(bm, geom=verts + edges + faces, plane_co=inverse @ point,
                               plane_no=(normal_to_local @ normal).normalized())
    doomed = []
    for face in bm.faces:
        c = world @ face.calc_center_median()
        if x0 < c.x < x1 and y0 < c.z < y1 and z0 < -c.y < z1:
            doomed.append(face)
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    REPORT.append(f'{name}: opening {x0:.2f}..{x1:.2f} × {y0:.2f}..{y1:.2f}, {len(doomed)} faces')


def restyle(name, mapping):
    """Swaps materials on an existing object, slot by slot."""
    obj = bpy.data.objects.get(name)
    if obj is None:
        return
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    for slot_index, slot in enumerate(obj.material_slots):
        if slot.material and slot.material.name in mapping:
            obj.data.materials[slot_index] = mapping[slot.material.name]
    REPORT.append(f'restyled {name}')


def inside(point, volume):
    return all(lo <= v <= hi for v, (lo, hi) in zip(point, volume))


# ── upper floor: permanent geometry into the model ───────────────────────────
def upper_floor():
    # The purchased model's partitions and door inside the new master bathroom.
    delete_faces('Plane_Plaster_0', lambda x, y, z: inside((x, y, z), BATHROOM))
    # ...including the old partition's head (a 1 m downstand under the ceiling)
    # and its sill across the floor, whose centres sit just outside that volume.
    delete_faces('Plane_Plaster_0', lambda x, y, z: -7.6 < x < -2.9 and 13.6 < z < 14.2 and 6.88 < y < 9.95)
    # ...and the L-shaped partition of the purchased model's own bedroom, which
    # ran through the master bed (x -4.30 → -2.93, z 8.75 → 11.54).
    delete_faces('Plane_Plaster_0', lambda x, y, z: -4.36 < x < -2.88 and 8.7 < z < 11.6 and 7.0 < y < 9.85)
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and ('Door' in obj.name or obj.name.startswith('Cube.020_')) and inside(centre(obj), ((-8.0, -1.95), (6.5, 10.0), (12.3, 16.0))):
            remove(obj.name)
    # Doorways off the landing into the suite and the bathroom.
    # The second bedroom had no door at all: its landing wall was solid.
    for wall, (z_from, z_to) in (('W_SUITE_E', (10.95, 12.10)), ('W_BATH_E', (12.35, 13.40)), ('W_BED2_W', (9.2, 10.1))):
        obj = bpy.data.objects.get(wall)
        if obj is None:
            continue
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        x0, x1 = min(c.x for c in corners), max(c.x for c in corners)
        y0, y1 = min(c.z for c in corners), max(c.z for c in corners)
        z0, z1 = min(-c.y for c in corners), max(-c.y for c in corners)
        mat = obj.material_slots[0].material if obj.material_slots else UPPER_PLASTER
        pieces = []
        if z_from > z0:
            pieces.append((x0, x1, y0, y1, z0, z_from))
        if z_to < z1:
            pieces.append((x0, x1, y0, y1, z_to, z1))
        pieces.append((x0, x1, y0 + 2.2, y1, z_from, z_to))
        remove(wall)
        boxes(wall, pieces, mat)
    # The landing: the purchased model's door leaves between the gallery and the
    # two halves of the landing become open doorways, a stray 9 cm wall stub
    # that narrowed the way to the suite goes, and the void's glass rail stops
    # short of the stair, whose top step it used to bar.
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('Door.001_', 'Door.002_')):
            remove(obj.name)
    delete_faces('Plane_Plaster_0', lambda x, y, z: -1.62 < x < -1.43 and 11.4 < z < 12.76 and 7.0 < y < 9.85)
    for name in ('W_VOID_RAIL', 'W_VOID_CAP'):
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        x0 = min(c.x for c in corners)
        y0, y1 = min(c.z for c in corners), max(c.z for c in corners)
        z0, z1 = min(-c.y for c in corners), max(-c.y for c in corners)
        mat = obj.material_slots[0].material if obj.material_slots else GLASS
        remove(name)
        box(name, x0, .8, y0, y1, z0, z1, mat)
    # Behind the new pivot door the purchased model's own façade wall was still
    # standing (z 16.22): the door opened onto plaster. A real opening, the
    # leaf's size, now leads into the hall.
    cut_opening('Plane_Plaster_0', 3.49, 4.96, 3.78, 6.63, 15.8, 16.3)
    # Reveals: the wall is 33 cm thick (z 15.89 → 16.22); close its edges.
    plaster = bpy.data.objects['Plane_Plaster_0'].material_slots[0].material
    boxes('ENTRY_REVEALS', [
        (3.41, 3.49, 3.78, 6.71, 15.88, 16.23),
        (4.96, 5.04, 3.78, 6.71, 15.88, 16.23),
        (3.41, 5.04, 6.63, 6.71, 15.88, 16.23),
    ], plaster)
    # The second bedroom had no window: its east wall (x 4.39 → 4.76) stood
    # behind the bay glazed in east_facade(). The wall is opened to that bay.
    cut_opening('Plane_Plaster_0', 4.3, 4.85, 7.0, 9.7, 9.15, 11.85)
    plaster = bpy.data.objects['Plane_Plaster_0'].material_slots[0].material
    boxes('BED2_WINDOW_REVEALS', [
        (4.36, 4.78, 6.92, 7.0, 9.1, 11.9),
        (4.36, 4.78, 9.7, 9.78, 9.1, 11.9),
        (4.36, 4.78, 7.0, 9.7, 9.08, 9.15),
        (4.36, 4.78, 7.0, 9.7, 11.85, 11.92),
    ], plaster)
    # The bathroom had no roof over it in the purchased model. The ceiling sits
    # just under the tops of the marble linings (9.80) so no sky shows between.
    (bx0, bx1), _, (bz0, bz1) = BATHROOM
    box('BATH_CEILING', bx0 - .15, bx1 + .15, 9.77, 9.83, bz0 - .15, bz1 + .12, UPPER_PLASTER)


# ── the frame, the balcony, the lighter porch slab ───────────────────────────
def frame():
    # Old 0.8 m slab-and-upstand over the porch, and its 0.6 m railing on top.
    delete_faces('Plane_Plaster_0', lambda x, y, z: 2.1 <= x <= 7.0 and 16.3 <= z <= 18.15 and 6.7 <= y <= 7.7)
    for name in ('Cube.003_Glass_0', 'Cube.003_Glassend_0', 'Cube.003_Material_0'):
        delete_faces(name, lambda x, y, z: FRAME_X0 - .3 <= x <= FRAME_X1 + .3 and z >= 16.9)
    # The west canopy band from restructure_front.py becomes part of the frame.
    remove('FACADE_CANOPY_W')

    # Balcony slab: one 22 cm plane across the frame, also the porch ceiling.
    # Notched round the stair bay, whose half landing projects to z 16.8: the
    # slab must not cut the stair's headroom.
    boxes('FRAME_SLAB', [
        (FRAME_X0, STAIR_BAY[0], SLAB_Y0, SLAB_Y1, 16.05, FRAME_FRONT),
        (STAIR_BAY[0], STAIR_BAY[1], SLAB_Y0, SLAB_Y1, STAIR_BAY[2], FRAME_FRONT),
        (STAIR_BAY[1], FRAME_X1, SLAB_Y0, SLAB_Y1, 16.05, FRAME_FRONT),
    ], RENDER)
    # Wide lintel wrapping the old roof edge, and the two jambs.
    box('FRAME_LINTEL', FRAME_X0, FRAME_X1, LINTEL_Y0, LINTEL_Y1, FRAME_BACK, FRAME_FRONT, RENDER)
    boxes('FRAME_JAMBS', [
        (FRAME_X0, FRAME_X0 + JAMB, SLAB_Y1, LINTEL_Y0, FRAME_BACK, FRAME_FRONT),
        (FRAME_X1 - JAMB, FRAME_X1, SLAB_Y1, LINTEL_Y0, FRAME_BACK, FRAME_FRONT),
    ], RENDER)
    # Frameless glass balcony on a thin anthracite shoe and rail.
    gx0, gx1 = FRAME_X0 + JAMB, FRAME_X1 - JAMB
    gz = FRAME_FRONT - .12
    box('BALCONY_GLASS', gx0, gx1, SLAB_Y1 + .05, SLAB_Y1 + 1.02, gz - .01, gz + .01, GLASS)
    boxes('BALCONY_PROFILES', [
        (gx0, gx1, SLAB_Y1, SLAB_Y1 + .06, gz - .035, gz + .035),
        (gx0, gx1, SLAB_Y1 + 1.02, SLAB_Y1 + 1.05, gz - .025, gz + .025),
    ], RAIL)
    # Light under the lintel and in the balcony soffit beyond the porch.
    box('FRAME_LINTEL_LED', gx0 + .2, gx1 - .2, LINTEL_Y0 - .015, LINTEL_Y0, FRAME_FRONT - .42, FRAME_FRONT - .38, LED)
    boxes('FRAME_SOFFIT_DOWNLIGHTS', [(x - .07, x + .07, SLAB_Y0 - .015, SLAB_Y0, 18.3, 18.44) for x in (-1.9, -.2, 1.5, 6.6)], LENS)


def railings():
    """Every remaining railing in one language: clear glass, anthracite profile."""
    for name in ('Cube.003_Glassend_0', 'Cube.013_Glassend_0', 'Cube.026_Glassend_0'):
        restyle(name, {'Glassend': GLASS})
    for name in ('Cube.003_Material_0', 'Cube.029_Material_0'):
        restyle(name, {'Material.001': RAIL})
    for name in ('Cube.013_Chrome_0', 'Cube.026_Chrome_0'):
        restyle(name, {'Chrome': RAIL})


# ── east wall, garage ────────────────────────────────────────────────────────
def east_facade():
    x = 6.80
    windows = ((9.3, 10.5), (12.2, 13.4))
    for i, (z0, z1) in enumerate(windows):
        box(f'EAST_WINDOW_{i}', x, x + .03, 4.0, 6.45, z0, z1, ENTRY_GLASS)
    frames = []
    for z0, z1 in windows:
        frames += [(x, x + .09, 3.95, 6.5, z0 - .05, z0), (x, x + .09, 3.95, 6.5, z1, z1 + .05),
                   (x, x + .09, 3.95, 4.0, z0, z1), (x, x + .09, 6.45, 6.5, z0, z1)]
    boxes('EAST_WINDOW_FRAMES', frames, FRAME)
    # Oak screen beside the entrance side of the wall: the one warm accent.
    slats = []
    z, end = 14.3, 16.1
    while z + .045 <= end:
        slats.append((x, x + .07, 3.82, 6.62, z, z + .045))
        z += .105
    boxes('EAST_OAK_SCREEN', slats, OAK)
    # A tall bedroom bay on the upper east face, above the terrace.
    box('EAST_UPPER_BAY', 4.75, 4.78, 7.0, 9.7, 9.1, 11.9, TINTED)
    boxes('EAST_UPPER_BAY_FRAME', [
        (4.75, 4.84, 6.95, 9.75, 9.05, 9.1), (4.75, 4.84, 6.95, 9.75, 11.9, 11.95),
        (4.75, 4.84, 9.7, 9.75, 9.1, 11.9),
    ], FRAME)


def garage():
    remove('Plane_synthetic_wood_0')
    # The carport's floor west of the driveway went with the old stone
    # forecourt; pave it at driveway level up to the west lawn.
    box('CARPORT_FLOOR', -13.1, -7.6, .58, .705, 18.86, 22.3, DRIVE)
    x0, x1, z = -8.35, -3.45, 18.86
    box('GARAGE_DOOR_PANEL', x0, x1, .70, 3.50, z, z + .04, FRAME)
    fins = []
    x = x0 + .05
    while x + .06 <= x1 - .05:
        fins.append((x, x + .06, .74, 3.46, z + .04, z + .1))
        x += .14
    boxes('GARAGE_DOOR_FINS', fins, BRONZE)
    box('GARAGE_LINTEL', x0 - .1, x1 + .1, 3.50, 3.62, z - .02, z + .4, RENDER)
    box('GARAGE_LINTEL_LED', x0, x1, 3.49, 3.50, z + .3, z + .34, LED)
    boxes('CARPORT_DOWNLIGHTS', [(cx - .07, cx + .07, 2.92, 2.94, 20.6, 20.74) for cx in (-7.0, -4.8)], LENS)


def export():
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUTPUT, compress=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB_OUTPUT, export_format='GLB', export_cameras=False, export_lights=False,
        export_texcoords=True, export_normals=True, export_tangents=True, export_materials='EXPORT',
        export_yup=True, export_apply=False, export_extras=True,
    )


def main():
    global NEW
    NEW = collection('VOLUMES_RESTRUCTURED')
    upper_floor()
    frame()
    railings()
    east_facade()
    garage()
    for line in REPORT:
        print('VOLUMES', line)
    print('VOLUMES_NEW', len(NEW.objects))
    export()
    print('VOLUMES_DONE', GLB_OUTPUT)


main()
