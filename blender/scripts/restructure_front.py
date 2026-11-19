"""Restructures the villa's front as one composition on one axis.

The previous passes left three competing ways up — the purchased model's own
diagonal steps buried in the lawn, a two-flight stair on the east flank and
stepped stone terraces on both sides — and a front door that sat at the end
of the porch rather than on any axis. This removes every one of them
geometrically and rebuilds the front around the only bay where the façade
meets the entrance level: the covered porch between the stone tower
(x 2.18) and the east column (x 6.27).

    AXIS  x = 4.225 (centre of the porch bay)
    door ─ landing (3.80, 2.9 m deep) ─ stair 2.40 m, 2 × 9 risers of
    17.2 cm on 32 cm goings, mid landing 1.6 m ─ parvis (0.71) ─ pedestrian
    gate on the axis.
    Cars keep the west side: road → vehicle gate → driveway → garage.

The banks either side of the stair are rebuilt as two architectural tiers in
white render whose upper bed is level with the stair's mid landing.

Run after the other build scripts, on the production blend:
    blender -b blender/kaydan-villa-production.blend \\
        --python blender/scripts/restructure_front.py

Coordinates below are glTF/Three.js (x, y up, z towards the road); Blender is
Z-up, so (x, y, z) is written to Blender as (x, -z, y).
"""

import os
import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND_OUTPUT = os.path.join(ROOT, 'blender', 'kaydan-villa-production.blend')
GLB_OUTPUT = os.path.join(ROOT, 'assets-source', 'models', 'kaydan-villa-production.glb')

# ── composition ──────────────────────────────────────────────────────────────
AXIS = 4.225
PARVIS_Y = 0.70
ENTRY_Y = 3.80
RISERS = 18
RISER = (ENTRY_Y - PARVIS_Y) / RISERS      # 0.1722
GOING = 0.32
STAIR_W = 2.40
CHEEK = 0.25
LANDING_FRONT = 19.10                      # front edge of the entrance landing
MID_LANDING = 1.60
FLIGHT = 8 * GOING                         # 9 risers, 8 treads per flight
MID_START = LANDING_FRONT + FLIGHT         # 21.66
MID_END = MID_START + MID_LANDING          # 23.26
STAIR_FOOT = MID_END + FLIGHT              # 25.82
MID_Y = ENTRY_Y - 9 * RISER                # 2.25
STAIR_X0 = AXIS - STAIR_W / 2              # 3.025
STAIR_X1 = AXIS + STAIR_W / 2              # 5.425
WEST_EDGE = -1.60                          # pedestrian composition, west limit
EAST_EDGE = 10.45                          # and east limit (retaining wall face)
FENCE_Z = 33.0


def B(x, y, z):
    return Vector((x, -z, y))


# ── materials ────────────────────────────────────────────────────────────────
def material(name, base, roughness, metallic=0.0, emission=None, strength=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
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
    return bpy.data.materials.get(name) or fallback


RENDER = material('KAYDAN_RENDER_WHITE', (.86, .84, .80), .82)
TRAVERTINE = existing('KAYDAN_TREAD', material('KAYDAN_TREAD', (.66, .625, .565), .5))
PAVING = existing('KAYDAN_PAVING', material('KAYDAN_PAVING', (.6, .58, .55), .55))
DRIVE = material('KAYDAN_DRIVE', (.30, .295, .285), .62)
SOIL = existing('KAYDAN_SOIL', material('KAYDAN_SOIL', (.13, .10, .07), .95))
LAWN = existing('KAYDAN_LAWN', material('KAYDAN_LAWN', (.115, .175, .075), .94))
GLASS = existing('Glass', material('Glass', (.9, .9, .9), .02))
TINTED = material('KAYDAN_TINTED_GLASS', (.18, .2, .21), .04)
ENTRY_GLASS = material('KAYDAN_ENTRY_GLASS', (.06, .065, .07), .12, .3)
FRAME = material('KAYDAN_ENTRY_FRAME', (.10, .085, .07), .38, .7)
BRONZE = existing('KAYDAN_BRONZE', material('KAYDAN_BRONZE', (.36, .27, .18), .3, 1.))
DARKMETAL = existing('KAYDAN_FRONT_METAL', material('KAYDAN_FRONT_METAL', (.045, .045, .048), .34, 1.))
OAK = material('KAYDAN_DOOR_OAK', (.42, .30, .19), .48)
LED = material('KAYDAN_LED', (1, .93, .82), .4, emission=(1, .78, .52), strength=3.0)
LENS = existing('KAYDAN_LENS_WARM', LED)


# ── geometry helpers ─────────────────────────────────────────────────────────
def collection(name):
    coll = bpy.data.collections.get(name)
    if coll:
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        return coll
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


NEW = None


def world_uvs(bm):
    """Box-projected UVs in metres, so materials tile at real-world scale on
    a 12 m parvis as on a 30 cm tread."""
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
    """Axis-aligned box from glTF bounds."""
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    _cube(bm, x0, x1, y0, y1, z0, z1)
    return link(name, bm, mat)


def boxes(name, bounds, mat):
    """Many boxes merged into one mesh: one draw call for a repeated element."""
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    for b in bounds:
        _cube(bm, *b)
    return link(name, bm, mat)


def prism(name, x0, x1, profile, mat):
    """Extrudes a (z, y) profile along x — cheek walls and raking glass."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    a = [bm.verts.new(B(x0, y, z)) for z, y in profile]
    b = [bm.verts.new(B(x1, y, z)) for z, y in profile]
    bm.faces.new(a)
    bm.faces.new(b)
    for i in range(len(profile)):
        j = (i + 1) % len(profile)
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in bm.faces:
        n = face.normal
        for loop in face.loops:
            co = loop.vert.co
            loop[uv].uv = (co.y, co.z) if abs(n.x) > .5 else (co.x, co.z) if abs(n.y) > .5 else (co.x, co.y)
    return link(name, bm, mat)


def cylinder(name, x, y0, y1, z, radius, mat):
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=radius, radius2=radius, depth=y1 - y0, calc_uvs=True)
    bmesh.ops.translate(bm, vec=B(x, (y0 + y1) / 2, z), verts=bm.verts)
    return link(name, bm, mat)


def disc(name, x, y, z, radius, mat):
    bm = bmesh.new()
    bm.loops.layers.uv.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=radius, radius2=radius, depth=.012, calc_uvs=True)
    bmesh.ops.translate(bm, vec=B(x, y, z), verts=bm.verts)
    return link(name, bm, mat)


# ── demolition ───────────────────────────────────────────────────────────────
REMOVED = []

# Every element of the previous approaches, by the names the build scripts gave them.
DEMOLISH_PREFIXES = (
    'STEP_', 'STAIR_LANDING', 'CHEEK_', 'STEPLIGHT_', 'ARRIVAL_', 'BED_STAIR_',
    'TERRACE_E_', 'TERRACE_W_', 'FOUND_', 'FORECOURT', 'DRIVEWAY', 'HEDGE_', 'BOLLARD',
    'GATE_', 'FENCE_', 'PIER_END', 'INTERCOM', 'CROSSOVER', 'LAWN_W', 'LAWN_E',
    # The decorative timber panel and its chrome bars left of the tower, and the
    # recessed porch window the new entrance replaces.
    'Cube.018_Chrome', 'Cube.021_Glass', 'Cube.021_WindowFrame',
    # Upper-floor windows over the porch, replaced by one curtain wall.
    'Cube.019_', 'Cube.006_',
    # The low stone curb that drew the old lawn's curve across the forecourt.
    'Plane.004_rock_wall',
)


def in_front(x, z):
    return WEST_EDGE - .35 <= x <= EAST_EDGE + .3 and 17.4 <= z <= FENCE_Z + .3


def demolish_objects():
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            continue
        name = obj.name
        doomed = name.startswith(DEMOLISH_PREFIXES)
        # Specimen trees standing where the new driveway, parvis or stair go.
        if name.startswith('Bonsai'):
            centre = obj.matrix_world.translation
            gx, gz = centre.x, -centre.y
            doomed = -8.0 <= gx <= EAST_EDGE + .4 and 18.4 <= gz <= FENCE_Z + .4
        if doomed:
            REMOVED.append(name)
            bpy.data.objects.remove(obj, do_unlink=True)


KEEP_PREFIXES = ('RETAIN_', 'WALK_', 'APPROACH_', 'BAY_', 'ROAD', 'KERB', 'VERGE', 'GARAGE_', 'Bonsai')


def sweep_front():
    """Anything else the earlier builders left inside the new driveway, parvis,
    stair or fence line goes too, so no fragment of an old access survives."""
    for coll_name in ('FRONT_APPROACH', 'FRONT_GARDEN', 'STREET'):
        coll = bpy.data.collections.get(coll_name)
        if not coll:
            continue
        for obj in list(coll.objects):
            if obj.type != 'MESH' or obj.name.startswith(KEEP_PREFIXES):
                continue
            corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
            cx = sum(c.x for c in corners) / 8
            cz = -sum(c.y for c in corners) / 8
            cy = sum(c.z for c in corners) / 8
            if -13.6 <= cx <= EAST_EDGE + .35 and 17.8 <= cz <= FENCE_Z + .6 and cy < 4.2:
                REMOVED.append(obj.name)
                bpy.data.objects.remove(obj, do_unlink=True)


def delete_faces(name, predicate):
    """Removes faces of a merged mesh whose centre satisfies predicate(x, y, z)."""
    obj = bpy.data.objects.get(name)
    if obj is None:
        return 0
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    world = obj.matrix_world
    doomed = []
    for face in bm.faces:
        c = world @ face.calc_center_median()
        if predicate(c.x, c.z, -c.y):
            doomed.append(face)
    bmesh.ops.delete(bm, geom=doomed, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    REMOVED.append(f'{name}: {len(doomed)} faces')
    return len(doomed)


def demolish_terrain():
    # The purchased model's own front steps and terrace lip (the diagonal stair
    # that showed through the lawn).
    delete_faces('Plane_Concrete048_0', lambda x, y, z: WEST_EDGE - .7 <= x <= EAST_EDGE + .3 and z >= 17.45 and y < 3.85)
    # The grassed banks either side of the old stairs, down to the fence.
    delete_faces('Plane.003_Ground003_0', lambda x, y, z: WEST_EDGE - .3 <= x <= EAST_EDGE + .25 and 17.6 <= z <= FENCE_Z + .2)
    # ...and the terrain that poked through the new west lawn.
    delete_faces('Plane.003_Ground003_0', lambda x, y, z: -18.7 <= x < WEST_EDGE - .3 and 22.3 <= z <= FENCE_Z + .2 and y < 1.4)
    # Stone edges of those banks, including the diagonal wall across the forecourt.
    # The tower (above entrance level) is kept as the façade's one stone accent.
    delete_faces('Plane_rock_wall_11_disp_2k_0', lambda x, y, z: WEST_EDGE - .3 <= x <= EAST_EDGE + .3 and 17.6 <= z <= FENCE_Z + .3 and y < 3.85)
    # The flat stone base the old forecourt sat on.
    delete_faces('Plane.006_stone_pathway_02_0', lambda x, y, z: x > -13.2)


# ── rebuild: landing, stair, tiers ───────────────────────────────────────────
def build_landing():
    # One continuous entrance landing from the west wing to the east walk.
    box('LANDING_SLAB', WEST_EDGE, EAST_EDGE, ENTRY_Y - .22, ENTRY_Y, 15.6, LANDING_FRONT, TRAVERTINE)
    # Its front wall, full height, so nothing of the old bank shows beneath.
    for side, (x0, x1) in (('W', (WEST_EDGE, STAIR_X0 - CHEEK)), ('E', (STAIR_X1 + CHEEK, EAST_EDGE))):
        box(f'LANDING_WALL_{side}', x0, x1, PARVIS_Y, ENTRY_Y, LANDING_FRONT, LANDING_FRONT + .25, RENDER)
        box(f'LANDING_BALUSTRADE_{side}', x0, x1, ENTRY_Y + .05, ENTRY_Y + 1.0, LANDING_FRONT + .115, LANDING_FRONT + .135, GLASS)
        box(f'LANDING_BALUSTRADE_SHOE_{side}', x0, x1, ENTRY_Y, ENTRY_Y + .06, LANDING_FRONT + .09, LANDING_FRONT + .16, FRAME)
    # East parapet, in line with the walk along the east flank.
    box('LANDING_PARAPET_E', EAST_EDGE, EAST_EDGE + .25, ENTRY_Y - .22, ENTRY_Y + 1.0, 15.6, LANDING_FRONT + .25, RENDER)


def build_stair():
    slope = RISER / GOING
    bodies, treads, leds = [], [], []
    for top, z_start in ((ENTRY_Y, LANDING_FRONT), (MID_Y, MID_END)):
        for k in range(1, 9):
            y_top = top - k * RISER
            z0 = z_start + (k - 1) * GOING
            z1 = z0 + GOING
            # Riser body set 3 cm back under a 6 cm travertine tread: the nosing
            # throws a crisp shadow line and hides the LED strip.
            bodies.append((STAIR_X0, STAIR_X1, PARVIS_Y, y_top - .06, z0, z1 - .03))
            treads.append((STAIR_X0, STAIR_X1, y_top - .06, y_top, z0, z1))
            leds.append((STAIR_X0 + .12, STAIR_X1 - .12, y_top - .075, y_top - .062, z1 - .045, z1 - .03))
    boxes('STAIR_RISERS', bodies, TRAVERTINE)
    boxes('STAIR_TREADS', treads, TRAVERTINE)
    boxes('STAIR_LEDS', leds, LED)
    box('STAIR_MID_LANDING', STAIR_X0, STAIR_X1, PARVIS_Y, MID_Y, MID_START, MID_END, TRAVERTINE)

    # Cheek walls in white render following the nosing line, glass above.
    top = .12
    nosing_upper = lambda z: ENTRY_Y - (z - LANDING_FRONT) * slope
    nosing_lower = lambda z: MID_Y - (z - MID_END) * slope
    cheek = [
        (LANDING_FRONT, PARVIS_Y), (STAIR_FOOT, PARVIS_Y),
        (STAIR_FOOT, nosing_lower(STAIR_FOOT) + top), (MID_END, MID_Y + top),
        (MID_START, MID_Y + top), (MID_START, nosing_upper(MID_START) + top),
        (LANDING_FRONT, ENTRY_Y + top),
    ]
    glass_h = .95
    upper = [(LANDING_FRONT, ENTRY_Y + top), (MID_START, nosing_upper(MID_START) + top),
             (MID_START, nosing_upper(MID_START) + top + glass_h), (LANDING_FRONT, ENTRY_Y + top + glass_h)]
    middle = [(MID_START, MID_Y + top), (MID_END, MID_Y + top), (MID_END, MID_Y + top + glass_h), (MID_START, MID_Y + top + glass_h)]
    lower = [(MID_END, MID_Y + top), (STAIR_FOOT, nosing_lower(STAIR_FOOT) + top),
             (STAIR_FOOT, nosing_lower(STAIR_FOOT) + top + glass_h), (MID_END, MID_Y + top + glass_h)]
    for side, (x0, x1) in (('W', (STAIR_X0 - CHEEK, STAIR_X0)), ('E', (STAIR_X1, STAIR_X1 + CHEEK))):
        prism(f'STAIR_CHEEK_{side}', x0, x1, cheek, RENDER)
        mid = (x0 + x1) / 2
        for label, profile in (('UPPER', upper), ('MID', middle), ('LOWER', lower)):
            prism(f'STAIR_GLASS_{side}_{label}', mid - .01, mid + .01, profile, GLASS)


def build_tiers():
    """Two planted tiers either side, the upper one level with the mid landing."""
    for side, (x0, x1) in (('W', (WEST_EDGE, STAIR_X0 - CHEEK)), ('E', (STAIR_X1 + CHEEK, EAST_EDGE))):
        box(f'TIER1_BED_{side}', x0, x1, PARVIS_Y, MID_Y - .05, LANDING_FRONT + .25, MID_START, SOIL)
        box(f'TIER1_WALL_{side}', x0, x1, PARVIS_Y, MID_Y + .05, MID_START, MID_START + .25, RENDER)
        box(f'TIER2_BED_{side}', x0, x1, PARVIS_Y, 1.12, MID_START + .25, STAIR_FOOT - .52, SOIL)
        box(f'TIER2_WALL_{side}', x0, x1, PARVIS_Y, 1.18, STAIR_FOOT - .52, STAIR_FOOT - .27, RENDER)
    # Closing walls: against the driveway on the west, the east bank on the east.
    box('TIER_SIDE_W_HIGH', WEST_EDGE - .25, WEST_EDGE, PARVIS_Y, ENTRY_Y, 17.6, LANDING_FRONT + .25, RENDER)
    box('TIER_SIDE_W_MID', WEST_EDGE - .25, WEST_EDGE, PARVIS_Y, MID_Y + .05, LANDING_FRONT + .25, MID_START + .25, RENDER)
    box('TIER_SIDE_W_LOW', WEST_EDGE - .25, WEST_EDGE, PARVIS_Y, 1.18, MID_START + .25, STAIR_FOOT - .27, RENDER)
    box('EAST_RETAINING_WALL', EAST_EDGE, EAST_EDGE + .25, PARVIS_Y, 2.9, LANDING_FRONT + .25, FENCE_Z - .15, RENDER)
    box('EAST_RETAINING_CAP', EAST_EDGE - .02, EAST_EDGE + .27, 2.9, 2.96, LANDING_FRONT + .25, FENCE_Z - .15, TRAVERTINE)


# ── rebuild: parvis, driveway, gates ─────────────────────────────────────────
def build_ground():
    box('PARVIS', WEST_EDGE - .25, EAST_EDGE, PARVIS_Y - .12, PARVIS_Y + .01, STAIR_FOOT - .27, FENCE_Z - .15, PAVING)
    # Driveway in a darker granite so the car route reads apart from the parvis.
    box('DRIVE', -7.6, WEST_EDGE - .25, PARVIS_Y - .12, PARVIS_Y + .005, 18.9, FENCE_Z - .15, DRIVE)
    # Planted strip between the car and the pedestrian, in white render.
    d0, d1, d2, d3 = -2.35, -2.2, WEST_EDGE - .4, WEST_EDGE - .25
    boxes('DRIVE_DIVIDER_WALLS', [
        (d0, d1, PARVIS_Y, 1.12, STAIR_FOOT - .27, FENCE_Z - .6),
        (d2, d3, PARVIS_Y, 1.12, STAIR_FOOT - .27, FENCE_Z - .6),
        (d0, d3, PARVIS_Y, 1.12, FENCE_Z - .75, FENCE_Z - .6),
        (d0, d3, PARVIS_Y, 1.12, STAIR_FOOT - .27, STAIR_FOOT - .12),
    ], RENDER)
    box('DRIVE_DIVIDER_BED', d1, d2, PARVIS_Y, 1.08, STAIR_FOOT - .12, FENCE_Z - .75, SOIL)
    # Lawn west of the driveway.
    box('LAWN_WEST', -13.1, -7.6, PARVIS_Y - .1, PARVIS_Y + .04, 22.3, FENCE_Z - .15, LAWN)
    # West of the fence line the old stone base is gone too: grass to the plot edge.
    box('LAWN_WEST_EDGE', -18.6, -13.1, PARVIS_Y - .1, PARVIS_Y + .04, 18.9, FENCE_Z + .2, LAWN)
    # Bollards marking the axis.
    spots = ((AXIS - 2.6, 28.2), (AXIS + 2.6, 28.2), (AXIS - 2.6, 31.4), (AXIS + 2.6, 31.4))
    boxes('AXIS_BOLLARDS', [(x - .07, x + .07, PARVIS_Y, PARVIS_Y + .62, z - .07, z + .07) for x, z in spots], DARKMETAL)
    boxes('AXIS_BOLLARD_LENSES', [(x - .05, x + .05, PARVIS_Y + .5, PARVIS_Y + .56, z + .07, z + .078) for x, z in spots], LENS)


def build_fence():
    z0, z1 = FENCE_Z - .15, FENCE_Z + .15
    ped0, ped1 = AXIS - .75, AXIS + .75
    car0, car1 = -7.6, -2.35
    segments = ((-13.1, car0 - .45), (car1 + .45, ped0 - .45), (ped1 + .45, EAST_EDGE + .25))
    walls, copings, slats = [], [], []
    for x0, x1 in segments:
        walls.append((x0, x1, PARVIS_Y, 1.25, z0, z1))
        copings.append((x0 - .02, x1 + .02, 1.25, 1.31, z0 - .02, z1 + .02))
        count = int((x1 - x0) / .16)
        for s in range(count):
            x = x0 + .08 + s * (x1 - x0 - .16) / max(1, count - 1)
            slats.append((x - .025, x + .025, 1.31, 2.9, FENCE_Z - .03, FENCE_Z + .03))
        slats.append((x0, x1, 2.9, 2.95, FENCE_Z - .04, FENCE_Z + .04))
    # Piers either side of each opening.
    for x in (car0 - .45, car1, ped0 - .45, ped1):
        walls.append((x, x + .45, PARVIS_Y, 3.15, z0 - .05, z1 + .05))
        copings.append((x - .02, x + .47, 3.15, 3.21, z0 - .07, z1 + .07))
    boxes('FENCE_WALLS', walls, RENDER)
    boxes('FENCE_COPINGS', copings, TRAVERTINE)
    boxes('GATE_PIER_LENSES', [(x - .08, x + .08, 2.55, 2.62, z1 + .05, z1 + .058) for x in (ped0 - .225, ped1 + .225)], LENS)
    # Vehicle gate: one bronze slatted leaf; pedestrian gate: oak in a bronze frame.
    count = int((car1 - car0) / .14)
    for s in range(count):
        x = car0 + .07 + s * (car1 - car0 - .14) / max(1, count - 1)
        slats.append((x - .03, x + .03, PARVIS_Y + .08, 2.9, FENCE_Z - .04, FENCE_Z + .04))
    slats.append((car0, car1, 2.9, 2.96, FENCE_Z - .05, FENCE_Z + .05))
    slats.append((car0, car1, PARVIS_Y + .08, PARVIS_Y + .14, FENCE_Z - .05, FENCE_Z + .05))
    boxes('FENCE_BRONZE', slats, BRONZE)
    box('GATE_PEDESTRIAN', ped0 + .04, ped1 - .04, PARVIS_Y + .04, 2.62, FENCE_Z - .03, FENCE_Z + .03, OAK)
    box('GATE_PEDESTRIAN_FRAME_TOP', ped0, ped1, 2.62, 2.7, FENCE_Z - .05, FENCE_Z + .05, FRAME)
    box('GATE_PEDESTRIAN_CANOPY', ped0 - .5, ped1 + .5, 3.21, 3.29, FENCE_Z - .6, FENCE_Z + .6, RENDER)
    box('INTERCOM_AXIS', ped1 + .12, ped1 + .3, 1.35, 1.65, z1 + .05, z1 + .08, DARKMETAL)
    # Road aprons: cars to the driveway, pedestrians on the axis.
    box('CROSSOVER_CAR', car0 - .3, car1 + .3, PARVIS_Y - .16, PARVIS_Y - .045, z1, 35.0, DRIVE)
    box('CROSSOVER_PEDESTRIAN', ped0 - .15, ped1 + .15, PARVIS_Y - .16, PARVIS_Y - .045, z1, 34.75, PAVING)


# ── rebuild: entrance and façade ─────────────────────────────────────────────
def build_entrance():
    wall_z = 16.22
    bay0, bay1 = 2.18, 6.27
    door0, door1 = AXIS - .75, AXIS + .75
    head = 6.64
    mullion = .06
    # Pivot door, 1.5 m, centred on the axis; full-height fixed glazing either side.
    box('ENTRY_DOOR', door0 + .02, door1 - .02, ENTRY_Y, head - .01, wall_z + .02, wall_z + .10, OAK)
    cylinder('ENTRY_DOOR_PULL', door0 + .3, ENTRY_Y + .55, ENTRY_Y + 2.15, wall_z + .17, .022, BRONZE)
    box('ENTRY_GLASS_W', bay0 + mullion, door0 - mullion, ENTRY_Y, head, wall_z + .04, wall_z + .06, ENTRY_GLASS)
    box('ENTRY_GLASS_E', door1 + mullion, bay1 - mullion, ENTRY_Y, head, wall_z + .04, wall_z + .06, ENTRY_GLASS)
    frame = [(x0, x1, ENTRY_Y, head, wall_z, wall_z + .12) for x0, x1 in ((bay0, bay0 + mullion), (door0 - mullion, door0), (door1, door1 + mullion), (bay1 - mullion, bay1))]
    frame.append((bay0, bay1, head, 6.80, wall_z, wall_z + .12))
    frame.append((bay0, bay1, ENTRY_Y, ENTRY_Y + .012, wall_z, wall_z + .5))
    boxes('ENTRY_FRAME', frame, FRAME)
    # Recessed downlights in the porch soffit.
    boxes('PORCH_DOWNLIGHTS', [(x - .07, x + .07, 6.785, 6.80, 17.08, 17.22) for x in (AXIS - 1.3, AXIS, AXIS + 1.3)], LENS)


def build_facade():
    # Upper floor over the porch: one three-panel curtain wall in place of two
    # punched windows, behind the existing glass balcony.
    z = 16.12
    x0, x1 = 2.18, 6.27
    y0, y1 = 6.86, 9.86
    box('UPPER_CURTAIN_GLASS', x0, x1, y0, y1, z - .01, z + .01, TINTED)
    mullions = [(x0 + i * (x1 - x0) / 3 - .03, x0 + i * (x1 - x0) / 3 + .03, y0, y1, z - .04, z + .06) for i in range(4)]
    mullions.append((x0, x1, y1 - .06, y1, z - .04, z + .06))
    boxes('UPPER_CURTAIN_FRAME', mullions, FRAME)
    # The decorative timber panel left of the tower becomes glazing.
    panel = bpy.data.objects.get('Cube.018_Wood049_0')
    if panel:
        panel.data = panel.data.copy()
        panel.data.materials.clear()
        panel.data.materials.append(GLASS)
    # A slim white canopy carries the porch's horizontal line across the tower
    # and over the ground-floor glazing to the west wing.
    box('FACADE_CANOPY_W', -2.6, 2.18, 6.80, 7.02, 16.9, 18.02, RENDER)


def export():
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUTPUT, compress=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB_OUTPUT,
        export_format='GLB',
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials='EXPORT',
        export_yup=True,
        export_apply=False,
        export_extras=True,
    )


def main():
    global NEW
    demolish_objects()
    sweep_front()
    demolish_terrain()
    NEW = collection('FRONT_RESTRUCTURED')
    build_landing()
    build_stair()
    build_tiers()
    build_ground()
    build_fence()
    build_entrance()
    build_facade()
    print('RESTRUCTURE_REMOVED', len(REMOVED))
    for item in REMOVED:
        print('RESTRUCTURE_REMOVED_ITEM', item)
    print('RESTRUCTURE_NEW', len(NEW.objects))
    print(f'RESTRUCTURE stair: {RISERS} risers of {RISER * 100:.1f} cm, goings {GOING * 100:.0f} cm, '
          f'width {STAIR_W} m, foot z {STAIR_FOOT:.2f}, mid landing {MID_START:.2f}-{MID_END:.2f} at y {MID_Y:.2f}')
    export()
    print('RESTRUCTURE_DONE', BLEND_OUTPUT, GLB_OUTPUT)


main()
