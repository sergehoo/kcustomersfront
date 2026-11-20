"""Hangs real curtains and settles the pool water, after refine_details.py.

* Curtains — the living-room and bedroom sheers were a flat grid bent along one
  sine, and the suite's drapes four bevelled boxes: both read as rigid panels.
  Each one is rebuilt as hung fabric: a gathered heading under the track, folds
  of uneven width and depth that loosen and wander towards the hem, a slight
  belly, a hem that is not a ruled line. Sheers stay KAYDAN_SHEER (the runtime
  makes them translucent and lets them breathe); the suite gets lined linen
  drapes in their own material, KAYDAN_DRAPE_LINEN.
  UVs: u is the arc length across the fabric in metres, v runs 0 at the hem to
  1 at the heading — the runtime sway is weighted by it.
* Pool — the water surface was modelled with 14 cm swells, 23 to 37 cm under
  the coping. It is flattened (ripples are the shader's job) and raised to 11 cm
  under the coping, the level of a pool that is actually full.

`scripts/optimizeProductionVilla.mjs` leaves the curtain materials out of mesh
simplification: at the web ratio the folds collapsed back into flat panels.

Run after refine_details.py, in the same Blender session, before
camera_shots.py:
    blender -b blender/backup-avant-restructuration-2026-11-19/kaydan-villa-production.blend \\
      --python blender/scripts/restructure_front.py \\
      --python blender/scripts/restructure_volumes.py \\
      --python blender/scripts/furnish_interiors.py \\
      --python blender/scripts/refine_details.py \\
      --python blender/scripts/refine_textiles.py \\
      --python blender/scripts/refine_media.py \\
      --python blender/scripts/camera_shots.py \\
      --python blender/scripts/merge_furniture.py

Coordinates are glTF (x, y up, z towards the road): Blender (x, -z, y).
"""

import math
import random
import bmesh
import bpy
from mathutils import Vector

F0 = 3.789         # ground floor
F1 = 6.90          # upper floor
CEIL0 = 6.798
COPING = 3.79      # top of the pool coping
WATER_LEVEL = COPING - .11

REPORT = []


def B(x, y, z):
    return Vector((x, -z, y))


def smoothstep(a, b, x):
    t = min(1, max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def remove(prefixes):
    gone = 0
    for obj in list(bpy.data.objects):
        if any(obj.name == p or obj.name.startswith(p + '_') or obj.name.startswith(p + '.') for p in prefixes):
            bpy.data.objects.remove(obj, do_unlink=True)
            gone += 1
    return gone


def drape_material():
    """Lined linen for the suite: its own material so the runtime can give it a
    weave and a sheen without touching the headboard's linen."""
    mat = bpy.data.materials.get('KAYDAN_DRAPE_LINEN')
    if mat:
        return mat
    mat = bpy.data.materials.new('KAYDAN_DRAPE_LINEN')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (.78, .73, .65, 1)
    bsdf.inputs['Roughness'].default_value = .92
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = .5
    mat.use_backface_culling = False
    return mat


def hang(name, mat, coll, centre, plane, bottom, top, width, axis='x', folds=6, depth=.035, seed=0):
    """A hung panel. `centre` is the middle of its width along `axis`, `plane`
    the coordinate of the track on the other horizontal axis; `depth` is the
    half-depth of a fold."""
    rng = random.Random(seed)
    per_fold, rows = 8, 22
    cols = folds * per_fold
    height = top - bottom

    raw = [1 + rng.uniform(-.3, .3) for _ in range(folds)]
    total = sum(raw)
    bounds = [0.0]
    for w in raw:
        bounds.append(bounds[-1] + w / total)
    amps = [depth * rng.uniform(.72, 1.22) for _ in range(folds)]
    phase = [rng.uniform(0, math.tau) for _ in range(folds)]
    # How far each fold line has wandered sideways by the time it reaches the hem.
    wander = [0.0] + [rng.uniform(-.022, .022) for _ in range(folds - 1)] + [0.0]
    side = rng.choice((-1, 1))
    belly = rng.uniform(.006, .016)

    def point(c, r):
        i = min(c // per_fold, folds - 1)
        t = (c - i * per_fold) / per_fold
        v = r / rows
        low = (1 - v) ** 1.6
        left = bounds[i] + wander[i] * low / width
        right = bounds[i + 1] + wander[i + 1] * low / width
        s = left + (right - left) * t
        across = (s - .5) * width * (1 + .045 * low)
        wave = math.sin(math.tau * t)
        wave = math.copysign(abs(wave) ** .8, wave)
        # Gathered under the track, full just below, a little looser at the hem.
        gather = 1 - .5 * smoothstep(1 - .06 / height, 1, v)
        amp = amps[i] * gather * (1 + .14 * math.sin(phase[i] + 2.4 * v))
        # Blend neighbouring fold depths so the surface stays continuous.
        if t > .5 and i + 1 < folds:
            nxt = amps[i + 1] * gather * (1 + .14 * math.sin(phase[i + 1] + 2.4 * v))
            amp += (nxt - amp) * smoothstep(.75, 1, t) * .5
        elif t < .5 and i > 0:
            prv = amps[i - 1] * gather * (1 + .14 * math.sin(phase[i - 1] + 2.4 * v))
            amp += (prv - amp) * (1 - smoothstep(0, .25, t)) * .5
        out = wave * amp + side * belly * math.sin(math.pi * s) * low
        lift = .004 * (1 + math.sin(phase[i] + math.tau * t)) * (1 - smoothstep(0, .08, v))
        y = bottom + lift + v * (height - lift)
        return B(centre + across, y, plane + out) if axis == 'x' else B(plane + out, y, centre + across)

    bm = bmesh.new()
    grid = [[bm.verts.new(point(c, r)) for c in range(cols + 1)] for r in range(rows + 1)]
    for r in range(rows):
        for c in range(cols):
            bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    bm.normal_update()

    # Arc length across the fabric, measured half-way up.
    mid = grid[rows // 2]
    arc = [0.0]
    for c in range(cols):
        arc.append(arc[-1] + (mid[c + 1].co - mid[c].co).length)
    layer = bm.loops.layers.uv.new('UVMap')
    index = {}
    for r, row in enumerate(grid):
        for c, vert in enumerate(row):
            index[vert] = (arc[c], r / rows)
    for face in bm.faces:
        face.smooth = True
        for loop in face.loops:
            loop[layer].uv = index[loop.vert]

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections[coll].objects.link(obj)
    REPORT.append(f'{name}: {len(mesh.polygons) * 2} tris, {folds} folds, fabric {arc[-1]:.2f} m for {width:.2f} m')
    return obj


def curtains():
    sheer = bpy.data.materials['KAYDAN_SHEER']
    sheer.use_backface_culling = False
    linen = drape_material()

    gone = remove(['Living_Curtain', 'Bed2_Curtain'])
    for i, x in enumerate((-3.7, 3.3)):
        hang(f'Living_Curtain_{i}', sheer, 'FURNISHING', x, 8.74, F0 + .012, CEIL0 - .045, .78, axis='x', folds=7, depth=.036, seed=31 + i)
    # Sheers either side of the east window of bedroom 2.
    for i, z in enumerate((9.42, 11.58)):
        hang(f'Bed2_Curtain_{i}', sheer, 'FURNISHING', z, 4.31, F1 + .012, 9.65, .52, axis='z', folds=5, depth=.03, seed=41 + i)

    # The suite's four boxes become lined drapes stacked either side of each bay.
    for obj in list(bpy.data.objects):
        if obj.name.startswith('CURTAIN_') and obj.name[8:9].isdigit():
            bpy.data.objects.remove(obj, do_unlink=True)
            gone += 1
    for i, x in enumerate((-7.7, -5.3, -4.5, -2.3)):
        hang(f'CURTAIN_{i}', linen, 'MASTER_SUITE', x, 8.78, F1 + .022, F1 + 2.68, .5, axis='x', folds=5, depth=.046, seed=51 + i)
    REPORT.append(f'curtains: {gone} old panels removed')


def pool():
    """Flat and full: every vertex of the water surface goes to one level."""
    moved = 0
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not any(slot.material and slot.material.name == 'Water' for slot in obj.material_slots):
            continue
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        world = obj.matrix_world
        inverse = world.inverted()
        before = [(world @ v.co).z for v in obj.data.vertices]
        for vert in obj.data.vertices:
            p = world @ vert.co
            p.z = WATER_LEVEL
            vert.co = inverse @ p
        obj.data.update()
        moved += 1
        REPORT.append(f'{obj.name}: water {min(before):.2f}–{max(before):.2f} → {WATER_LEVEL:.2f}')
    if not moved:
        REPORT.append('pool: no object carries the Water material')


def main():
    curtains()
    pool()
    for line in REPORT:
        print('TEXTILES', line)
    print('TEXTILES_DONE')


main()
