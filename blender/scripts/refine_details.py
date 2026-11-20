"""Refines the pieces the visit frames closest, after furnish_interiors.py.

* Master bathroom — the island tub was a subdivided block with a slab of
  "water" standing proud of its rim. It becomes a freestanding solid-surface
  tub: a thin rounded lip, a shell that tapers to a recessed plinth, a basin
  with a reclined back, and a gooseneck floor-standing filler.
* Walk-in shower — the bar, valve, niche and rain arm hung in mid-air (on a
  plane at z 14.05 where no wall stands). Everything moves onto the wet wall
  the shower shot faces (x −2.01): a marble wet wall with a recessed niche, a
  thermostatic mixer with two controls, a wall-arm rain head, a hand shower on
  its rail with its hose, a linear drain.
* Both beds — flat slabs of "duvet" lay over the pillows. The duvet is now
  draped by a cloth simulation over the mattress (folds, corners, overhang), a
  turned-down band and a runner follow the same way, and the pillows are
  shaped (soft piped seams, euro shams leaning on the headboard). The bedding
  gets a linen weave.

The two living-room lounge chairs are placed by furnish_interiors.py.

Run after furnish_interiors.py, in the same Blender session, before
camera_shots.py (whose bed, tub and shower anchors are pinned, so the validated
framings do not move with the new pieces):
    blender -b blender/backup-avant-restructuration-2026-11-19/kaydan-villa-production.blend \\
      --python blender/scripts/restructure_front.py \\
      --python blender/scripts/restructure_volumes.py \\
      --python blender/scripts/furnish_interiors.py \\
      --python blender/scripts/refine_details.py \\
      --python blender/scripts/camera_shots.py \\
      --python blender/scripts/merge_furniture.py

Coordinates are glTF (x, y up, z towards the road): Blender (x, -z, y).
"""

import math
import random
import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

F1 = 6.90          # upper floor
FLOOR_TOP = 6.92   # bathroom stone floor

REPORT = []
random.seed(7)


def B(x, y, z):
    return Vector((x, -z, y))


# ── scene helpers ────────────────────────────────────────────────────────────
def select_only(objects, active):
    layer = bpy.context.view_layer
    layer.update()
    for obj in bpy.data.objects:
        if obj.name in layer.objects:
            obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    layer.objects.active = active


def apply_modifiers(obj):
    if not obj.modifiers:
        return
    if obj.data.users > 1:
        obj.data = obj.data.copy()
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)


def remove(names):
    gone = 0
    for obj in list(bpy.data.objects):
        if any(obj.name == n or obj.name.startswith(n + '_') or obj.name.startswith(n + '.') for n in names):
            bpy.data.objects.remove(obj, do_unlink=True)
            gone += 1
    return gone


def link(obj, coll_name):
    coll = bpy.data.collections[coll_name]
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def new_object(name, bm, mat, coll_name, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections[coll_name].objects.link(obj)
    REPORT.append(name)
    return obj


def modifier(obj, kind, **settings):
    mod = obj.modifiers.new(kind.lower(), kind)
    for key, value in settings.items():
        setattr(mod, key, value)
    return mod


def support(x, z, above, ignore=()):
    """Height (glTF y) of the first surface under (x, above, z)."""
    dg = bpy.context.evaluated_depsgraph_get()
    origin = B(x, above, z)
    while True:
        ok, loc, _n, _i, obj, _m = bpy.context.scene.ray_cast(dg, origin, Vector((0, 0, -1)))
        if not ok:
            return None
        if obj.name in ignore:
            origin = loc + Vector((0, 0, -1e-3))
            continue
        return loc.z


# ── materials ────────────────────────────────────────────────────────────────
def weave_image(name, size=512, threads=64):
    """A linen weave as a tangent-space normal map: plain over-under weave,
    threads of uneven thickness (slubs) and a faint irregular grain."""
    img = bpy.data.images.get(name)
    if img:
        return img
    rng = np.random.default_rng(11)
    period = size / threads
    coords = np.arange(size)
    u = (coords % period) / period
    profile = np.sin(np.pi * u) ** .7                       # a thread's cross-section
    thick_x = 1 + .35 * rng.standard_normal(threads)         # slubs, per thread
    thick_y = 1 + .35 * rng.standard_normal(threads)
    tx = thick_x[(coords // period).astype(int)]
    ty = thick_y[(coords // period).astype(int)]
    warp = (profile * tx)[None, :]                             # threads along y
    weft = (profile * ty)[:, None]                             # threads along x
    cell_x = (coords // period).astype(int)[None, :]
    cell_y = (coords // period).astype(int)[:, None]
    over = ((cell_x + cell_y) % 2 == 0)
    height = np.where(over, np.maximum(warp * 1.0, weft * .55), np.maximum(weft * 1.0, warp * .55))
    grain = rng.standard_normal((size // 16, size // 16))
    grain = np.kron(grain, np.ones((16, 16)))
    height = height + .08 * grain
    gy, gx = np.gradient(height)
    strength = 2.2
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(height)
    length = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    rgb = np.stack([nx / length, ny / length, nz / length], axis=-1) * .5 + .5
    rgba = np.concatenate([rgb, np.ones((size, size, 1))], axis=-1).astype(np.float32)
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = 'PNG'
    img.pack()
    return img


def fabric(name, color, roughness, normal_strength=.45, tile=.06, sheen=.4):
    """Bedding: a matte cotton-linen with the weave above, `tile` metres per
    repeat (UVs of the pieces built here are in metres)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = sheen
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (1 / tile, 1 / tile, 1)
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = weave_image('KAYDAN_LINEN_WEAVE')
    normal = nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = normal_strength
    links.new(coord.outputs['UV'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    links.new(tex.outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def solid(name, color, roughness, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat


# ── geometry builders ────────────────────────────────────────────────────────
def superellipse(a, b, n, count, cx=0.0, back=0.0):
    """Closed rounded-rectangle outline (|x/a|^n + |y/b|^n = 1). `back`
    pulls the +x side in, for a basin's reclined back."""
    pts = []
    for k in range(count):
        t = 2 * math.pi * k / count
        c, s = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(c) ** (2 / n), c)
        y = b * math.copysign(abs(s) ** (2 / n), s)
        if x > 0:
            x *= 1 - back
        pts.append((cx + x, y))
    return pts


def loft(rings, cap_bottom=True, cap_top=False):
    """Rings of (x, y, z) points, same count each, joined by quads."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for r in range(len(rings) - 1):
        for k in range(n):
            a, b = vs[r][k], vs[r][(k + 1) % n]
            c, d = vs[r + 1][(k + 1) % n], vs[r + 1][k]
            bm.faces.new((a, b, c, d))
    if cap_bottom:
        bm.faces.new(list(reversed(vs[0])))
    if cap_top:
        bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def tube(points, radius, sides=16, caps=True):
    """A circular section swept along a polyline (Blender coordinates),
    smoothed by Catmull-Rom, with parallel-transported frames."""
    pts = [Vector(p) for p in points]
    if len(pts) > 2:
        smooth = []
        ext = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
        for i in range(1, len(ext) - 2):
            p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
            for k in range(8):
                t = k / 8
                smooth.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
        smooth.append(pts[-1])
        pts = smooth
    tangents = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        tangents.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(tangents[0].z) < .9 else Vector((1, 0, 0))
    normal = tangents[0].cross(ref).normalized()
    rings = []
    for i, p in enumerate(pts):
        if i:
            axis = tangents[i - 1].cross(tangents[i])
            if axis.length > 1e-6:
                angle = tangents[i - 1].angle(tangents[i])
                normal = (Matrix.Rotation(angle, 3, axis.normalized()) @ normal).normalized()
        binormal = tangents[i].cross(normal)
        rings.append([tuple(p + (normal * math.cos(2 * math.pi * k / sides) + binormal * math.sin(2 * math.pi * k / sides)) * radius) for k in range(sides)])
    return loft(rings, cap_bottom=caps, cap_top=caps)


def rounded_box(size, centre, bevel, segments=3):
    """Box in glTF axes (sx, sy up, sz), bevelled — returns a bmesh."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((size[0], size[2], size[1])), verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, profile=.5, affect='EDGES')
    bmesh.ops.translate(bm, vec=B(*centre), verts=bm.verts)
    return bm


def cylinder(radius, depth, centre, axis='y', sides=32, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=radius, radius2=radius, depth=depth)
    if bevel:
        caps = [e for e in bm.edges if not e.is_manifold or abs(e.calc_face_angle(0)) > .5]
        bmesh.ops.bevel(bm, geom=caps, offset=bevel, segments=2, profile=.5, affect='EDGES')
    # create_cone is along Blender z (= glTF y).
    if axis == 'x':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    elif axis == 'z':      # glTF z = Blender −y
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, vec=B(*centre), verts=bm.verts)
    return bm


def merge(*bms):
    out = bmesh.new()
    for bm in bms:
        mesh = bpy.data.meshes.new('tmp')
        bm.to_mesh(mesh)
        bm.free()
        out.from_mesh(mesh)
        bpy.data.meshes.remove(mesh)
    return out


def metric_uv(obj):
    """Box-projected UVs in metres, so a fabric tiles at its real scale."""
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name='UVMap')
    uv = mesh.uv_layers.active.data
    world = obj.matrix_world
    for poly in mesh.polygons:
        n = (world.to_3x3() @ poly.normal)
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = world @ mesh.vertices[mesh.loops[li].vertex_index].co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            uv[li].uv = (u, v)


# ── bathroom: island tub ─────────────────────────────────────────────────────
def tub(marble, brass):
    remove(['BATH_TUB', 'BATH_TUB_WELL', 'BATH_TUB_FILLER', 'BATH_TUB_SPOUT'])
    cx, cz = -6.55, 15.05
    a, b, n, count = .85, .405, 3.2, 96
    rim = .58
    # (inset from the outer outline in metres, height above the floor). The
    # basin rings (inset > .036) also pull in on the east side: the reclined back.
    profile = [
        (.075, 0.0), (.075, .03), (.05, .036), (.03, .06), (.012, .2), (.003, .4),
        (0.0, .53), (0.0, .562), (.004, .575), (.012, .58), (.024, .58), (.032, .576),
        (.037, .566), (.041, .548), (.055, .45), (.075, .33), (.105, .24), (.15, .185),
        (.19, .168), (.22, .165),
    ]
    rings = []
    for inset, height in profile:
        depth = max(0.0, (rim - .02 - height) / (rim - .163)) if inset > .036 else 0.0
        back = .32 * depth ** 1.3
        outline = superellipse(a - inset, b - inset, n, count, back=back)
        rings.append([tuple(B(cx + x, FLOOR_TOP + height, cz - y)) for x, y in outline])
    shell = loft(rings, cap_bottom=True, cap_top=True)
    white = solid('KAYDAN_TUB_SOLID', (.93, .925, .905), .16)
    obj = new_object('BATH_TUB', shell, white, 'MASTER_BATHROOM')
    # Waste in the basin floor, at the foot (west) end.
    drain = new_object('BATH_TUB_WASTE', cylinder(.032, .006, (cx - .42, FLOOR_TOP + .166, cz)), brass, 'MASTER_BATHROOM')
    # Floor-standing filler at the west end: column, gooseneck over the rim,
    # mixer lever, hand shower in its cradle.
    fx = cx - a - .17
    top = FLOOR_TOP + .96
    plate = cylinder(.065, .012, (fx, FLOOR_TOP + .006, cz), sides=40, bevel=.004)
    column = tube([B(fx, FLOOR_TOP + .01, cz), B(fx, top - .1, cz)], .021, sides=24)
    neck = tube([B(fx, top - .12, cz), B(fx, top - .02, cz), B(fx + .07, top + .06, cz),
                 B(fx + .2, top + .05, cz), B(fx + .28, top - .03, cz), B(fx + .3, top - .12, cz)], .016, sides=20)
    lever = tube([B(fx, top - .22, cz), B(fx - .02, top - .2, cz), B(fx - .09, top - .19, cz)], .007, sides=12)
    cradle = cylinder(.018, .05, (fx, top - .36, cz + .03), sides=20)
    handset = tube([B(fx, top - .52, cz + .052), B(fx, top - .3, cz + .052)], .016, sides=20)
    filler = new_object('BATH_TUB_FILLER', merge(plate, column, neck, lever, cradle, handset), brass, 'MASTER_BATHROOM')
    REPORT.append(f'tub {len(obj.data.polygons)} faces, filler {len(filler.data.polygons)} faces, waste {drain.name}')


# ── bathroom: shower on its wet wall ─────────────────────────────────────────
def shower(marble, brass):
    remove(['BATH_SHOWER_BAR', 'BATH_SHOWER_VALVE', 'BATH_NICHE', 'BATH_RAIN_ARM', 'BATH_RAIN_HEAD'])
    wall_x = -2.01                       # face of W_BATH_E, inside the shower
    z0, z1 = 13.75, 15.83                # front of the tray → north wall
    top = 9.77                           # ceiling
    t = .06                              # wet-wall thickness (marble on battens)
    face = wall_x - t
    # Niche 0.42 × 0.3, 6 cm deep, its sill at 1.25 m.
    nz0, nz1, ny0, ny1 = 15.05, 15.47, F1 + 1.25, F1 + 1.55
    cx = wall_x - t / 2
    pieces = [
        rounded_box((t, top - F1, nz0 - z0), (cx, (F1 + top) / 2, (z0 + nz0) / 2), .004, 2),
        rounded_box((t, top - F1, z1 - nz1), (cx, (F1 + top) / 2, (nz1 + z1) / 2), .004, 2),
        rounded_box((t, ny0 - F1, nz1 - nz0), (cx, (F1 + ny0) / 2, (nz0 + nz1) / 2), 0, 1),
        rounded_box((t, top - ny1, nz1 - nz0), (cx, (ny1 + top) / 2, (nz0 + nz1) / 2), 0, 1),
        rounded_box((.008, ny1 - ny0, nz1 - nz0), (wall_x - .004, (ny0 + ny1) / 2, (nz0 + nz1) / 2), 0, 1),
    ]
    wet = new_object('BATH_WET_WALL', merge(*pieces), marble, 'MASTER_BATHROOM', smooth=False)
    metric_uv(wet)
    # Thermostatic mixer: a slim plate with the temperature and flow controls.
    mz, my = 14.42, F1 + 1.08
    plate = rounded_box((.014, .26, .1), (face - .007, my, mz), .005, 3)
    knob_a = cylinder(.027, .045, (face - .036, my + .06, mz), axis='x', bevel=.004)
    knob_b = cylinder(.027, .045, (face - .036, my - .06, mz), axis='x', bevel=.004)
    grip_a = rounded_box((.012, .044, .008), (face - .062, my + .06, mz), .003, 2)
    grip_b = rounded_box((.012, .044, .008), (face - .062, my - .06, mz), .003, 2)
    mixer = new_object('BATH_SHOWER_MIXER', merge(plate, knob_a, knob_b, grip_a, grip_b), brass, 'MASTER_BATHROOM')
    # Rain head on a wall arm, over the middle of the tray.
    hy = F1 + 2.2
    flange = cylinder(.035, .012, (face - .006, hy, 14.62), axis='x')
    arm = tube([B(face, hy, 14.62), B(face - .3, hy, 14.62), B(face - .52, hy - .01, 14.62), B(face - .58, hy - .04, 14.62)], .012, sides=16)
    head = cylinder(.15, .012, (face - .6, hy - .05, 14.62), sides=48, bevel=.004)
    rain = new_object('BATH_RAIN_HEAD', merge(flange, arm, head), brass, 'MASTER_BATHROOM')
    # Hand shower: rail with its glider, the handset, the hose to the outlet.
    rz = 14.86
    rail = tube([B(face - .03, F1 + .9, rz), B(face - .03, F1 + 1.62, rz)], .011, sides=16)
    brackets = [rounded_box((.03, .025, .025), (face - .015, y, rz), .004, 2) for y in (F1 + .92, F1 + 1.6)]
    glider = rounded_box((.04, .05, .035), (face - .045, F1 + 1.42, rz), .006, 2)
    handset = tube([B(face - .07, F1 + 1.27, rz), B(face - .075, F1 + 1.45, rz), B(face - .09, F1 + 1.52, rz)], .015, sides=18)
    handhead = cylinder(.034, .03, (face - .1, F1 + 1.535, rz), axis='y', sides=32, bevel=.004)
    outlet = cylinder(.022, .03, (face - .015, F1 + .74, 14.7), axis='x', bevel=.003)
    hose = tube([B(face - .07, F1 + 1.27, rz), B(face - .08, F1 + 1.0, rz + .02), B(face - .09, F1 + .6, rz + .01),
                 B(face - .06, F1 + .58, 14.76), B(face - .035, F1 + .7, 14.71), B(face - .02, F1 + .74, 14.7)], .0075, sides=10)
    hand = new_object('BATH_HAND_SHOWER', merge(rail, *brackets, glider, handset, handhead, outlet, hose), brass, 'MASTER_BATHROOM')
    # The tray stopped 19 cm short of the wall: a marble strip closes it, with
    # the linear drain along the wet wall.
    strip = new_object('BATH_SHOWER_TRAY_STRIP', rounded_box((face + 2.2, .04, 1.6), ((-2.2 + face) / 2, 6.92, 14.55), 0, 1), marble, 'MASTER_BATHROOM', smooth=False)
    metric_uv(strip)
    drain = new_object('BATH_SHOWER_DRAIN', rounded_box((.05, .004, 1.3), (face - .065, 6.941, 14.55), .001, 1), brass, 'MASTER_BATHROOM', smooth=False)
    REPORT.append(f'shower: {wet.name}, {mixer.name}, {rain.name}, {hand.name}, {drain.name}')


# ── beds ─────────────────────────────────────────────────────────────────────
def grid(name, x0, x1, z0, z1, y, step, mat, coll, rumple=0.0):
    """A horizontal sheet of quads (glTF extents), UVs in metres. `rumple`
    lifts it into soft random swells before it falls, so it settles with the
    loose creases of real bedding instead of a stretched-flat surface."""
    nx = max(2, round((x1 - x0) / step))
    nz = max(2, round((z1 - z0) / step))
    phases = [random.uniform(0, 2 * math.pi) for _ in range(4)]

    def lift(x, z):
        return rumple * (math.sin(x * 6.3 + phases[0]) * math.sin(z * 4.7 + phases[1])
                         + .5 * math.sin(x * 11.0 + z * 3.1 + phases[2]) + .35 * math.sin(z * 13.0 - x * 2.0 + phases[3]))

    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows = []
    for j in range(nz + 1):
        z = z0 + (z1 - z0) * j / nz
        rows.append([bm.verts.new(B(x, y + lift(x, z), z)) for x in (x0 + (x1 - x0) * i / nx for i in range(nx + 1))])
    for j in range(nz):
        for i in range(nx):
            face = bm.faces.new((rows[j][i], rows[j + 1][i], rows[j + 1][i + 1], rows[j][i + 1]))
            for loop in face.loops:
                co = loop.vert.co
                loop[uv].uv = (co.x, co.y)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    return new_object(name, bm, mat, coll)


def drape(cloth, colliders, frames=48, bending=2.0, mass=.25, thickness=.05):
    """Lets `cloth` fall onto `colliders`, then bakes the result into the mesh
    with its thickness. Every temporary modifier is removed: the merge step
    and the glTF export (export_apply=False) only take plain meshes."""
    for obj in colliders:
        obj.modifiers.new('collision', 'COLLISION')
        obj.collision.thickness_outer = .006
        obj.collision.cloth_friction = 8
        obj.collision.damping = .6
    mod = cloth.modifiers.new('cloth', 'CLOTH')
    s = mod.settings
    s.quality = 8
    s.mass = mass
    s.tension_stiffness = s.compression_stiffness = 20
    s.shear_stiffness = 8
    s.bending_stiffness = bending
    s.air_damping = 2.5
    mod.collision_settings.distance_min = .008
    mod.collision_settings.use_self_collision = False
    mod.point_cache.frame_start = 1
    mod.point_cache.frame_end = frames
    scene = bpy.context.scene
    scene.frame_start = 1
    for frame in range(1, frames + 1):
        scene.frame_set(frame)
    with bpy.context.temp_override(object=cloth, active_object=cloth, selected_objects=[cloth], selected_editable_objects=[cloth]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    scene.frame_set(1)
    for obj in colliders:
        for m in [m for m in obj.modifiers if m.type == 'COLLISION']:
            obj.modifiers.remove(m)
    modifier(cloth, 'SOLIDIFY', thickness=thickness, offset=1.0, use_even_offset=True)
    modifier(cloth, 'SUBSURF', levels=1, render_levels=1)
    apply_modifiers(cloth)
    for poly in cloth.data.polygons:
        poly.use_smooth = True


def pillow(name, width, depth, height, mat, coll, sag=.0):
    """A pillow: two domed faces meeting at a piped seam, slightly sagging in
    the middle. Built flat, centred on the origin (Blender axes: width x,
    depth y, height z) — UVs in metres."""
    nu, nv = 22, 16
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')

    crease = [random.uniform(0, 2 * math.pi) for _ in range(2)]

    def dome(u, v):
        # Rounded like a filled case, never box-flat, with a faint uneven fill.
        fill = (max(0.0, 1 - abs(u) ** 2.4) * max(0.0, 1 - abs(v) ** 2.4)) ** .7
        return fill * (1 + .07 * math.sin(u * 4.1 + crease[0]) * math.sin(v * 3.3 + crease[1]))

    def point(i, j, sign):
        u, v = -1 + 2 * i / nu, -1 + 2 * j / nv
        h = dome(u, v) * height / 2 * (1 - sag * (1 - u * u) * (1 - v * v))
        # Corners pull in a little, as a filled case does.
        pinch = 1 - .06 * (abs(u) * abs(v)) ** 2
        return Vector((u * width / 2 * pinch, v * depth / 2 * pinch, sign * h))

    top = {}
    bottom = {}
    for j in range(nv + 1):
        for i in range(nu + 1):
            edge = i in (0, nu) or j in (0, nv)
            top[i, j] = bm.verts.new(point(i, j, 1))
            bottom[i, j] = top[i, j] if edge else bm.verts.new(point(i, j, -1))
    for j in range(nv):
        for i in range(nu):
            for verts, flip in ((top, False), (bottom, True)):
                quad = [verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]]
                face = bm.faces.new(list(reversed(quad)) if flip else quad)
                for loop in face.loops:
                    co = loop.vert.co
                    loop[uv].uv = (co.x, co.y)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = new_object(name, bm, mat, coll)
    modifier(obj, 'SUBSURF', levels=1, render_levels=1)
    apply_modifiers(obj)
    return obj


def place(obj, x, z, y, tilt=0.0, yaw=0.0, roll=0.0):
    """Stands a piece built around the origin at glTF (x, y, z); `tilt` leans
    it back towards +z (degrees), `yaw` turns it about the vertical."""
    obj.rotation_euler = (math.radians(tilt), math.radians(roll), math.radians(yaw))
    obj.location = B(x, y, z)
    bpy.context.view_layer.update()
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def bed(prefix, coll, sheet, duvet_mat, runner_mat, accent_mat, euro):
    """Rebuilds a bed's soft goods over its existing base, mattress and headboard."""
    mattress = bpy.data.objects[f'{prefix}_MATTRESS']
    base = bpy.data.objects[f'{prefix}_BASE']
    remove([f'{prefix}_DUVET', f'{prefix}_DUVET_FOLD', f'{prefix}_THROW', f'{prefix}_CUSHION',
            f'{prefix}_PILLOW', f'{prefix}_PILLOW_BACK'])
    world = [mattress.matrix_world @ Vector(c) for c in mattress.bound_box]
    x0, x1 = min(c.x for c in world), max(c.x for c in world)
    z0, z1 = min(-c.y for c in world), max(-c.y for c in world)        # foot (z0) → head (z1)
    top = max(c.z for c in world)
    mattress.data.materials.clear()
    mattress.data.materials.append(sheet)
    metric_uv(mattress)
    width = x1 - x0
    # Everything around the bed the fabric could meet: the room's own pieces
    # (bench, nightstands, lamps) and, for bedroom 2, its window wall.
    soft_goods = ('_DUVET', '_THROW', '_PILLOW', '_CUSHION', '_RUG')
    room = bpy.data.collections[coll]
    colliders = [o for o in room.objects if o.type == 'MESH' and not any(k in o.name for k in soft_goods)]
    colliders += [o for o in bpy.data.objects if o.name == 'BED2_WINDOW_REVEALS' and prefix == 'BED2']
    east = .3 if prefix == 'BED' else .12               # bedroom 2 stands near its window wall
    # Duvet: from 30 cm past the foot to 52 cm short of the head, falling over the sides.
    duvet = grid(f'{prefix}_DUVET', x0 - .3, x1 + east, z0 - .3, z1 - .52, top + .12, .045, duvet_mat, coll, rumple=.018)
    drape(duvet, colliders, bending=4.0, mass=.35, thickness=.045)
    # The turned-down band at its head edge, falling the same way.
    band = grid(f'{prefix}_DUVET_FOLD', x0 - .3, x1 + east, z1 - .86, z1 - .5, top + .2, .04, sheet, coll, rumple=.01)
    drape(band, colliders + [duvet], frames=40, bending=3.0, mass=.25, thickness=.03)
    # Runner across the foot.
    runner = grid(f'{prefix}_THROW', x0 - .26, x1 + min(east, .26), z0 + .18, z0 + .7, top + .26, .04, runner_mat, coll)
    drape(runner, colliders + [duvet], frames=40, bending=1.2, mass=.3, thickness=.012)
    # Pillows, dressed as a hotel bed: (euro) shams against the headboard,
    # sleeping pillows leaning on them, an accent cushion in front.
    pw = min(.74, width / 2 - .05)
    for i, cx in enumerate((x0 + width / 4, x1 - width / 4)):
        cx += (-1) ** i * .015
        if euro:
            back = pillow(f'{prefix}_PILLOW_BACK_{i}', .62, .6, .24, sheet, coll, sag=.15)
            place(back, cx, z1 - .14, top + .28, tilt=-76, yaw=random.uniform(-2, 2))
            p = pillow(f'{prefix}_PILLOW_{i}', pw, .48, .19, sheet, coll, sag=.2)
            place(p, cx, z1 - .4, top + .15, tilt=-26, yaw=random.uniform(-3, 3), roll=random.uniform(-2, 2))
        else:
            p = pillow(f'{prefix}_PILLOW_{i}', pw, .46, .18, sheet, coll, sag=.2)
            place(p, cx, z1 - .27, top + .1, tilt=-14, yaw=random.uniform(-3, 3), roll=random.uniform(-2, 2))
    accent = pillow(f'{prefix}_CUSHION', .5, .3, .15, accent_mat, coll, sag=.1)
    cz = z1 - (.66 if euro else .55)
    y = (support((x0 + x1) / 2, cz, top + .6, ignore={accent.name}) or top) + .07
    place(accent, (x0 + x1) / 2, cz, y, tilt=-30)
    REPORT.append(f'{prefix}: duvet {len(duvet.data.polygons)} faces, mattress {width:.2f} × {z1 - z0:.2f} m')


def main():
    marble = bpy.data.materials['KAYDAN_UPPER_MARBLE']
    brass = bpy.data.materials['KAYDAN_BRASS']
    sheet = fabric('KAYDAN_BEDLINEN', (.92, .905, .87), .86)
    sand = fabric('KAYDAN_BEDLINEN_SAND', (.80, .74, .65), .88)
    runner = bpy.data.materials['KAYDAN_BOUCLE_DEEP']
    accent = bpy.data.materials['KAYDAN_UPPER_BOUCLE']
    tub(marble, brass)
    shower(marble, brass)
    bed('BED', 'MASTER_SUITE', sheet, sheet, runner, accent, euro=True)
    bed('BED2', 'SECOND_BEDROOM', sheet, sand, runner, accent, euro=False)
    for line in REPORT:
        print('REFINE', line)
    print('REFINE_DONE')


main()
