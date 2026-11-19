"""Builds the villa's upper storey: partitions, master suite, bathroom, dressing
and a second bedroom, then furnishes them.

The slab already exists (travertine at z = 6.90, ceiling at z = 9.90) but the
whole level was one bare 14 x 10 m plate with no walls and no furniture, which is
why the visit could only ever look at the staircase from below.

Run:
    blender -b blender/kaydan-villa-production.blend \
        --python blender/scripts/build_upper_floor.py

Blender is Z-up; the glTF export converts to Y-up, so glTF (x, y, z) reads here
as (x, z, -y).
"""

import math
import os
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, 'assets-source', 'materials', 'materials-1k')
ASSETS = os.path.join(ROOT, 'assets-source', 'models')

FLOOR = 6.90
CEIL = 9.90
WALL = 0.12

# ── collections ──────────────────────────────────────────────────────────────

def collection(name):
    existing = bpy.data.collections.get(name)
    if existing:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        return existing
    created = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(created)
    return created


UPPER = collection('UPPER_FLOOR')
SUITE = collection('MASTER_SUITE')
BATH = collection('MASTER_BATHROOM')
DRESS = collection('DRESSING')
BED2 = collection('SECOND_BEDROOM')


def put(obj, target):
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    target.objects.link(obj)


# ── materials ────────────────────────────────────────────────────────────────

def pbr(name, folder=None, base=(.8, .78, .74, 1), roughness=.6, metallic=0.,
        scale=1., sheen=0., clearcoat=0., use_basecolor=True):
    """A textured Principled material when a `materials-1k` folder is given,
    otherwise a plain one. Real maps beat flat colours at these camera distances.

    `use_basecolor=False` keeps the normal and roughness maps but drives the
    colour from `base`: the CC0 bouclé and deck-wood albedos carry a loud woven
    pattern and a red stain that read as upholstery fabric swatches rather than
    as a calm interior. Micro-relief is what those maps are worth here."""
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = base
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = sheen
    if 'Coat Weight' in bsdf.inputs:
        bsdf.inputs['Coat Weight'].default_value = clearcoat

    if folder:
        path = os.path.join(TEX, folder)
        coords = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (scale, scale, scale)
        links.new(coords.outputs['UV'], mapping.inputs['Vector'])

        def hook(filename, socket, non_color=True):
            full = os.path.join(path, filename)
            if not os.path.exists(full):
                return None
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = bpy.data.images.load(full, check_existing=True)
            if non_color:
                tex.image.colorspace_settings.name = 'Non-Color'
            links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
            if socket:
                links.new(tex.outputs['Color'], bsdf.inputs[socket])
            return tex

        if use_basecolor:
            hook('basecolor.webp', 'Base Color', non_color=False)
        hook('roughness.webp', 'Roughness')
        normal_tex = hook('normal.webp', None)
        if normal_tex:
            normal_map = nodes.new('ShaderNodeNormalMap')
            normal_map.inputs['Strength'].default_value = .85
            links.new(normal_tex.outputs['Color'], normal_map.inputs['Color'])
            links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


PLASTER = pbr('KAYDAN_UPPER_PLASTER', 'plastered_wall_04', base=(.86, .84, .80, 1), roughness=.82, scale=2.4)
MARBLE = pbr('KAYDAN_UPPER_MARBLE', 'marble_01', base=(.88, .87, .85, 1), roughness=.18, scale=1.6, clearcoat=.25)
OAK = pbr('KAYDAN_UPPER_OAK', 'wood_floor_deck', base=(.46, .37, .28, 1), roughness=.5, scale=1.1, use_basecolor=False)
BOUCLE = pbr('KAYDAN_UPPER_BOUCLE', 'wool_boucle', base=(.74, .70, .63, 1), roughness=.94, scale=3.0, sheen=.4, use_basecolor=False)
BOUCLE_DEEP = pbr('KAYDAN_BOUCLE_DEEP', 'wool_boucle', base=(.31, .28, .25, 1), roughness=.95, scale=2.4, sheen=.35, use_basecolor=False)
RUGMAT = pbr('KAYDAN_RUG', 'wool_boucle', base=(.55, .51, .46, 1), roughness=.96, scale=9.0, sheen=.3, use_basecolor=False)
LINEN = pbr('KAYDAN_LINEN', None, base=(.93, .92, .90, 1), roughness=.88, sheen=.5)
LINEN_WARM = pbr('KAYDAN_LINEN_WARM', None, base=(.86, .82, .75, 1), roughness=.9, sheen=.45)
BRASS = pbr('KAYDAN_BRASS', None, base=(.72, .56, .30, 1), roughness=.22, metallic=1.)
BLACKMETAL = pbr('KAYDAN_BLACKMETAL', None, base=(.06, .06, .06, 1), roughness=.35, metallic=1.)
GLASSMAT = pbr('KAYDAN_INNER_GLASS', None, base=(.92, .95, .96, 1), roughness=.04)
GLASSMAT.blend_method = 'BLEND' if hasattr(GLASSMAT, 'blend_method') else GLASSMAT.blend_method
GLASSMAT.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .22
DARKWOOD = pbr('KAYDAN_DARKWOOD', 'wood_floor_deck', base=(.19, .16, .14, 1), roughness=.4, scale=1.4, use_basecolor=False)


# ── primitives ───────────────────────────────────────────────────────────────

def box(name, size, location, material, coll, bevel=.012, segments=2, rotation=None):
    """Beveled box. A hard-edged cube reads as a placeholder; a 12 mm bevel
    catches a highlight and reads as a real manufactured edge."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = Vector(size)
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=bool(rotation), scale=True)
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    obj.data.materials.append(material)
    put(obj, coll)
    return obj


def soft(name, size, location, material, coll, levels=2, bevel=.05, rotation=None):
    """Rounded, upholstered volume for mattresses, pillows and cushions."""
    obj = box(name, size, location, material, coll, bevel=bevel, segments=3, rotation=rotation)
    sub = obj.modifiers.new('subsurf', 'SUBSURF')
    sub.levels = levels
    sub.render_levels = levels
    return obj


def cylinder(name, radius, depth, location, material, coll, vertices=28, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=vertices, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(material)
    put(obj, coll)
    return obj


def cone(name, r1, r2, depth, location, material, coll, vertices=28):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, vertices=vertices, location=location)
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(material)
    put(obj, coll)
    return obj


def wall(name, x0, y0, x1, y1, coll, height=CEIL - FLOOR, base=FLOOR, thickness=WALL, material=PLASTER):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    length = math.hypot(x1 - x0, y1 - y0)
    angle = math.atan2(y1 - y0, x1 - x0)
    return box(name, (length, thickness, height), (cx, cy, base + height / 2), material, coll,
               bevel=.008, rotation=(0, 0, angle))


# ── plan ─────────────────────────────────────────────────────────────────────
# Slab measured by ray-cast: x -8.25…6.0, y -16.0…-5.5, with the stairwell void
# around x -1.5…1.8 / y -16.0…-13.5.

def build_shell():
    # Master suite — south-west, opening onto the existing south glazing.
    wall('W_SUITE_N', -8.0, -12.1, -1.9, -12.1, UPPER)
    wall('W_SUITE_E', -1.9, -12.1, -1.9, -6.1, UPPER)
    # Bathroom + dressing block, north-west.
    wall('W_BATH_S', -8.0, -12.35, -1.9, -12.35, UPPER)
    wall('W_BATH_E', -1.95, -15.9, -1.95, -12.35, UPPER)
    wall('W_NORTH', -8.0, -15.9, -1.9, -15.9, UPPER)
    # Second bedroom, south-east.
    wall('W_BED2_W', 2.1, -12.1, 2.1, -6.2, UPPER)
    wall('W_BED2_N', 2.1, -12.1, 5.9, -12.1, UPPER)
    # Landing balustrade around the stairwell void.
    box('W_VOID_RAIL', (3.4, .05, 1.05), (.15, -13.45, FLOOR + .52), GLASSMAT, UPPER, bevel=.004)
    box('W_VOID_CAP', (3.4, .09, .05), (.15, -13.45, FLOOR + 1.06), BLACKMETAL, UPPER, bevel=.004)

    # Floor finishes laid over the existing travertine.
    box('F_SUITE_OAK', (6.05, 5.95, .02), (-4.95, -9.1, FLOOR + .012), OAK, UPPER, bevel=0)
    box('F_BATH_MARBLE', (5.95, 3.5, .02), (-5.0, -14.1, FLOOR + .012), MARBLE, UPPER, bevel=0)
    box('F_BED2_OAK', (3.75, 5.85, .02), (4.0, -9.15, FLOOR + .012), OAK, UPPER, bevel=0)


def build_master_bedroom():
    cx, cy = -4.9, -9.2

    # Upholstered headboard with vertical channels — a flat slab reads as cardboard.
    box('BED_HEADBOARD', (2.35, .14, 1.15), (cx, cy - 2.35, FLOOR + .68), BOUCLE, SUITE, bevel=.03, segments=3)
    for i in range(7):
        box(f'BED_CHANNEL_{i}', (.055, .05, 1.02), (cx - .95 + i * .317, cy - 2.28, FLOOR + .70),
            BOUCLE, SUITE, bevel=.02, segments=2)

    box('BED_BASE', (2.05, 2.15, .26), (cx, cy - 1.1, FLOOR + .14), DARKWOOD, SUITE, bevel=.02)
    soft('BED_MATTRESS', (1.95, 2.05, .32), (cx, cy - 1.1, FLOOR + .43), LINEN, SUITE, levels=2, bevel=.06)
    # Duvet folded back over the lower two thirds.
    soft('BED_DUVET', (2.02, 1.42, .17), (cx, cy - 1.45, FLOOR + .63), LINEN, SUITE, levels=2, bevel=.07)
    soft('BED_DUVET_FOLD', (2.02, .34, .12), (cx, cy - .82, FLOOR + .68), LINEN, SUITE, levels=2, bevel=.06)
    soft('BED_THROW', (2.02, .62, .10), (cx, cy - .46, FLOOR + .64), BOUCLE_DEEP, SUITE, levels=2, bevel=.05)
    for i, offset in enumerate((-.48, .48)):
        soft(f'BED_PILLOW_BACK_{i}', (.74, .20, .40), (cx + offset, cy - 2.18, FLOOR + .76),
             LINEN, SUITE, levels=3, bevel=.09, rotation=(math.radians(-14), 0, 0))
        soft(f'BED_PILLOW_{i}', (.74, .40, .15), (cx + offset, cy - 1.94, FLOOR + .655),
             LINEN, SUITE, levels=3, bevel=.09, rotation=(math.radians(-5), 0, 0))
    soft('BED_CUSHION', (.42, .18, .18), (cx, cy - 1.82, FLOOR + .72), LINEN_WARM, SUITE, levels=2, bevel=.05)

    for i, offset in enumerate((-1.55, 1.55)):
        box(f'NIGHTSTAND_{i}', (.52, .42, .44), (cx + offset, cy - 2.1, FLOOR + .23), DARKWOOD, SUITE, bevel=.015)
        box(f'NIGHTSTAND_TOP_{i}', (.58, .48, .03), (cx + offset, cy - 2.1, FLOOR + .46), MARBLE, SUITE, bevel=.008)
        box(f'NIGHTSTAND_PULL_{i}', (.16, .02, .02), (cx + offset, cy - 2.32, FLOOR + .3), BRASS, SUITE, bevel=.005)
        # Bedside lamp: a turned base and a tapered shade.
        cylinder(f'LAMP_BASE_{i}', .055, .30, (cx + offset, cy - 2.12, FLOOR + .62), BRASS, SUITE)
        cone(f'LAMP_SHADE_{i}', .17, .13, .22, (cx + offset, cy - 2.12, FLOOR + .87), LINEN_WARM, SUITE)

    box('BED_RUG', (3.6, 3.0, .015), (cx, cy - 1.0, FLOOR + .028), RUGMAT, SUITE, bevel=0)
    box('BED_BENCH', (1.5, .46, .10), (cx, cy + .28, FLOOR + .43), BOUCLE, SUITE, bevel=.03, segments=3)
    for i, (bx, by) in enumerate(((-.65, -.16), (.65, -.16), (-.65, .16), (.65, .16))):
        cylinder(f'BENCH_LEG_{i}', .022, .38, (cx + bx, cy + .28 + by, FLOOR + .19), BLACKMETAL, SUITE, vertices=14)

    # Reading corner against the glazing.
    armchair = os.path.join(ASSETS, 'external', 'furniture', 'modern-arm-chair.glb')
    if os.path.exists(armchair):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=armchair)
        for obj in set(bpy.data.objects) - before:
            if obj.parent is None:
                obj.location = Vector((-7.2, -9.1, FLOOR))
                obj.rotation_euler = (0, 0, math.radians(-124))
            put(obj, SUITE)
    box('SIDE_TABLE_TOP', (.44, .44, .03), (-6.5, -9.7, FLOOR + .48), MARBLE, SUITE, bevel=.01)
    cylinder('SIDE_TABLE_STEM', .03, .46, (-6.5, -9.7, FLOOR + .24), BLACKMETAL, SUITE)
    cylinder('SIDE_TABLE_FOOT', .17, .02, (-6.5, -9.7, FLOOR + .02), BLACKMETAL, SUITE)

    # Floor-length curtains framing the south bay.
    # Curtains hang on the inside face of the south glazing (Blender y = -8.6).
    for i, x in enumerate((-7.7, -5.3, -4.5, -2.3)):
        box(f'CURTAIN_{i}', (.44, .10, 2.66), (x, -8.78, FLOOR + 1.35), LINEN_WARM, SUITE, bevel=.05, segments=3)
    box('CURTAIN_TRACK', (5.9, .05, .04), (-4.95, -8.78, FLOOR + 2.70), BLACKMETAL, SUITE, bevel=.006)


def build_master_bathroom():
    """Fixtures are modelled here rather than imported. The CC-BY `modern_bathroom`
    asset arrives at 2.35x scale with several independent roots, and its own room
    shell would sit inside the villa's — a 5.4 m bathtub in a 3.5 m room. Building
    the pieces keeps the scale and the placement under control."""
    cx, cy = -5.0, -14.1

    # Stone shell.
    box('BATH_WALL_MARBLE', (5.9, .04, 2.9), (cx, -15.85, FLOOR + 1.45), MARBLE, BATH, bevel=0)
    box('BATH_WALL_W', (.04, 3.4, 2.9), (-7.95, cy, FLOOR + 1.45), MARBLE, BATH, bevel=0)

    # Freestanding oval bath: a rounded shell with an inset well.
    tub = soft('BATH_TUB', (1.72, .82, .56), (-6.55, -15.05, FLOOR + .30), MARBLE, BATH, levels=3, bevel=.14)
    tub.name = 'BATH_TUB'
    soft('BATH_TUB_WELL', (1.46, .58, .40), (-6.55, -15.05, FLOOR + .46), pbr('KAYDAN_TUB_WATER', None, base=(.86, .90, .91, 1), roughness=.06), BATH, levels=3, bevel=.10)
    cylinder('BATH_TUB_FILLER', .022, .62, (-7.50, -15.05, FLOOR + .60), BRASS, BATH)
    cylinder('BATH_TUB_SPOUT', .018, .30, (-7.38, -15.05, FLOOR + .88), BRASS, BATH,
             rotation=(0, math.radians(90), 0))

    # Walk-in shower: rain head on an arm, thermostatic bar, recessed niche.
    box('BATH_SHOWER_TRAY', (1.5, 1.6, .04), (-2.95, -14.55, FLOOR + .02), MARBLE, BATH, bevel=.01)
    cylinder('BATH_RAIN_HEAD', .13, .03, (-2.95, -14.55, FLOOR + 2.22), BRASS, BATH, vertices=32)
    cylinder('BATH_RAIN_ARM', .018, .42, (-2.95, -14.28, FLOOR + 2.22), BRASS, BATH,
             rotation=(math.radians(90), 0, 0))
    cylinder('BATH_SHOWER_BAR', .016, .95, (-2.95, -14.05, FLOOR + 1.35), BRASS, BATH)
    box('BATH_SHOWER_VALVE', (.11, .07, .16), (-2.95, -14.07, FLOOR + 1.02), BRASS, BATH, bevel=.02)
    box('BATH_NICHE', (.62, .06, .34), (-2.95, -14.04, FLOOR + 1.62), MARBLE, BATH, bevel=.01)
    box('BATH_SCREEN', (.04, 1.6, 2.2), (-3.75, -14.55, FLOOR + 1.1), GLASSMAT, BATH, bevel=.006)
    box('BATH_SCREEN_POST', (.05, .05, 2.2), (-3.75, -13.78, FLOOR + 1.1), BLACKMETAL, BATH, bevel=.006)

    # Double vanity.
    box('BATH_VANITY', (2.1, .52, .07), (-5.4, -12.5, FLOOR + .88), MARBLE, BATH, bevel=.02)
    box('BATH_VANITY_BODY', (2.02, .48, .52), (-5.4, -12.5, FLOOR + .58), DARKWOOD, BATH, bevel=.015)
    box('BATH_VANITY_PULL', (1.9, .02, .02), (-5.4, -12.75, FLOOR + .72), BRASS, BATH, bevel=.004)
    box('BATH_MIRROR', (2.0, .02, 1.05), (-5.4, -12.29, FLOOR + 1.72), GLASSMAT, BATH, bevel=.008)
    box('BATH_MIRROR_FRAME', (2.06, .02, 1.11), (-5.4, -12.27, FLOOR + 1.72), BRASS, BATH, bevel=.006)
    for i, x in enumerate((-6.05, -4.75)):
        soft(f'BATH_BASIN_{i}', (.50, .34, .13), (x, -12.5, FLOOR + .95), MARBLE, BATH, levels=2, bevel=.05)
        cylinder(f'BATH_TAP_{i}', .018, .24, (x, -12.68, FLOOR + 1.03), BRASS, BATH)
        cylinder(f'BATH_TAP_SPOUT_{i}', .015, .16, (x, -12.60, FLOOR + 1.14), BRASS, BATH,
                 rotation=(math.radians(90), 0, 0))
        box(f'BATH_SCONCE_{i}', (.05, .05, .34), (x, -12.31, FLOOR + 1.86), BRASS, BATH, bevel=.01)

    # WC, tucked against the west wall out of the main sightline.
    box('BATH_WC', (.38, .62, .42), (-7.6, -12.9, FLOOR + .21), MARBLE, BATH, bevel=.05, segments=3)
    box('BATH_WC_TANK', (.36, .16, .30), (-7.6, -13.24, FLOOR + .55), MARBLE, BATH, bevel=.03)
    soft('BATH_WC_SEAT', (.36, .50, .05), (-7.6, -12.86, FLOOR + .44), LINEN, BATH, levels=1, bevel=.03)

    # Soft goods and greenery.
    box('BATH_MAT', (1.3, .78, .03), (-5.4, -13.2, FLOOR + .035), BOUCLE, BATH, bevel=.01)
    for i, y in enumerate((-13.05, -13.42)):
        box(f'BATH_TOWEL_{i}', (.30, .06, .46), (-2.15, y, FLOOR + 1.22), LINEN, BATH, bevel=.03, segments=3)
    box('BATH_TOWEL_RAIL', (.46, .028, .028), (-2.15, -13.24, FLOOR + 1.48), BRASS, BATH, bevel=.005)
    cylinder('BATH_STOOL', .16, .42, (-4.55, -15.4, FLOOR + .21), DARKWOOD, BATH, vertices=20)
    box('BATH_STOOL_TOWEL', (.28, .24, .07), (-4.55, -15.4, FLOOR + .45), LINEN, BATH, bevel=.03, segments=3)


def build_dressing():
    """A fitted wardrobe run inside the bedroom rather than a separate room: the
    2 m closet could not be framed, and the space it took made the master
    bathroom unusable."""
    y = -11.85
    for i, x in enumerate((-7.35, -6.25, -5.15)):
        box(f'DRESS_CAB_{i}', (1.06, .58, 2.4), (x, y, FLOOR + 1.2), DARKWOOD, DRESS, bevel=.012)
        box(f'DRESS_CAB_FRONT_{i}', (1.02, .02, 2.34), (x, y - .30, FLOOR + 1.2), OAK, DRESS, bevel=.01)
        box(f'DRESS_PULL_{i}', (.02, .02, 1.0), (x - .22, y - .32, FLOOR + 1.34), BRASS, DRESS, bevel=.004)
        box(f'DRESS_PULL_B_{i}', (.02, .02, 1.0), (x + .22, y - .32, FLOOR + 1.34), BRASS, DRESS, bevel=.004)
    # Open bay with a hanging rail and folded stacks, so it reads as a dressing.
    box('DRESS_OPEN_BACK', (1.1, .04, 2.4), (-4.05, y + .28, FLOOR + 1.2), PLASTER, DRESS, bevel=0)
    box('DRESS_OPEN_SIDE', (.04, .58, 2.4), (-4.6, y, FLOOR + 1.2), DARKWOOD, DRESS, bevel=0)
    cylinder('DRESS_RAIL', .016, 1.0, (-4.05, y - .02, FLOOR + 1.86), BRASS, DRESS,
             rotation=(0, math.radians(90), 0))
    for i in range(7):
        box(f'DRESS_HANG_{i}', (.09, .34, .86), (-4.48 + i * .14, y - .02, FLOOR + 1.38),
            LINEN_WARM if i % 2 else BOUCLE_DEEP, DRESS, bevel=.02, segments=2)
    for i in range(3):
        box(f'DRESS_FOLD_{i}', (.44, .32, .09), (-4.05, y - .02, FLOOR + .58 + i * .1), LINEN, DRESS, bevel=.02)
    box('DRESS_MIRROR', (.62, .03, 1.65), (-3.05, y - .18, FLOOR + .88), GLASSMAT, DRESS, bevel=.008)
    box('DRESS_MIRROR_FRAME', (.68, .02, 1.71), (-3.05, y - .20, FLOOR + .88), BRASS, DRESS, bevel=.005)


def build_second_bedroom():
    cx, cy = 4.0, -9.4
    box('BED2_HEADBOARD', (1.55, .1, .95), (cx, cy - 1.9, FLOOR + .6), BOUCLE, BED2, bevel=.03, segments=3)
    box('BED2_BASE', (1.45, 1.95, .24), (cx, cy - .85, FLOOR + .13), DARKWOOD, BED2, bevel=.02)
    soft('BED2_MATTRESS', (1.36, 1.86, .28), (cx, cy - .85, FLOOR + .39), LINEN, BED2, levels=2, bevel=.05)
    soft('BED2_DUVET', (1.42, 1.30, .15), (cx, cy - 1.15, FLOOR + .56), LINEN_WARM, BED2, levels=2, bevel=.06)
    for i, offset in enumerate((-.32, .32)):
        soft(f'BED2_PILLOW_{i}', (.62, .34, .14), (cx + offset, cy - 1.70, FLOOR + .575), LINEN, BED2, levels=3, bevel=.08, rotation=(math.radians(-6), 0, 0))
    box('BED2_RUG', (2.6, 2.2, .015), (cx, cy - .7, FLOOR + .028), RUGMAT, BED2, bevel=0)
    box('BED2_NIGHT', (.44, .38, .4), (cx - 1.05, cy - 1.85, FLOOR + .21), DARKWOOD, BED2, bevel=.015)
    cylinder('BED2_LAMP_BASE', .045, .24, (cx - 1.05, cy - 1.85, FLOOR + .53), BRASS, BED2)
    cone('BED2_LAMP_SHADE', .14, .11, .18, (cx - 1.05, cy - 1.85, FLOOR + .73), LINEN_WARM, BED2)
    # Desk under the south glazing — a guest room that is actually usable.
    box('BED2_DESK', (1.5, .55, .04), (cx + .3, cy + 1.9, FLOOR + .73), OAK, BED2, bevel=.01)
    for i, (dx, dy) in enumerate(((-.7, -.24), (.7, -.24), (-.7, .24), (.7, .24))):
        cylinder(f'BED2_DESK_LEG_{i}', .022, .72, (cx + .3 + dx, cy + 1.9 + dy, FLOOR + .36), BLACKMETAL, BED2, vertices=14)
    box('BED2_DESK_CHAIR_SEAT', (.44, .44, .07), (cx + .3, cy + 1.3, FLOOR + .45), BOUCLE, BED2, bevel=.03, segments=3)
    box('BED2_DESK_CHAIR_BACK', (.44, .07, .5), (cx + .3, cy + 1.09, FLOOR + .72), BOUCLE, BED2, bevel=.03, segments=3)
    for i, (dx, dy) in enumerate(((-.18, -.18), (.18, -.18), (-.18, .18), (.18, .18))):
        cylinder(f'BED2_CHAIR_LEG_{i}', .018, .42, (cx + .3 + dx, cy + 1.3 + dy, FLOOR + .21), BLACKMETAL, BED2, vertices=12)
    box('BED2_SHELF', (1.3, .26, .04), (cx + .3, cy + 2.15, FLOOR + 1.5), OAK, BED2, bevel=.01)
    for i in range(6):
        box(f'BED2_BOOK_{i}', (.045, .18, .26), (cx - .25 + i * .075, cy + 2.15, FLOOR + 1.65),
            BOUCLE if i % 2 else LINEN_WARM, BED2, bevel=.006)


def build_lighting():
    """Ceiling fixtures so the rooms have a visible source rather than ambient wash."""
    lamp = os.path.join(ASSETS, 'external', 'lighting', 'modern-ceiling-lamp.glb')
    spots = [(-4.9, -9.2, SUITE), (-5.2, -14.0, BATH), (4.0, -9.4, BED2), (-6.8, -14.9, BATH)]
    for index, (x, y, coll) in enumerate(spots):
        if os.path.exists(lamp):
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=lamp)
            for obj in set(bpy.data.objects) - before:
                if obj.parent is None:
                    obj.location = Vector((x, y, CEIL - .55))
                put(obj, coll)
        else:
            cylinder(f'CEIL_LAMP_{index}', .12, .1, (x, y, CEIL - .2), LINEN_WARM, coll)


build_shell()
build_master_bedroom()
build_master_bathroom()
build_dressing()
build_second_bedroom()
build_lighting()

blend_out = os.path.join(ROOT, 'blender', 'kaydan-villa-production.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_out)

glb_out = os.path.join(ASSETS, 'kaydan-villa-production.glb')
bpy.ops.export_scene.gltf(
    filepath=glb_out,
    export_format='GLB',
    export_apply=True,
    export_yup=True,
    use_visible=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
)
print(f'UPPER FLOOR BUILT -> {glb_out}')
print('objects:', len(bpy.data.objects))
