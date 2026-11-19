"""Rebuilds the villa's arrival: forecourt, architectural stair, retaining
terraces, road, gate, fence and front landscaping.

The site rose 3.09 m over 3 m of depth — a 45 degree bank — so the only way up
was a run of irregular steps cut into the slope, which read as a hillside path
rather than the entrance to a house. This regrades the front into a flat paved
forecourt at driveway level, then climbs to the door in two regular flights.

Run after `build_upper_floor.py`:
    blender -b blender/kaydan-villa-production.blend \
        --python blender/scripts/build_front_approach.py

Blender is Z-up; glTF (x, y, z) reads here as (x, z, -y).
"""

import math
import os
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, 'assets-source', 'materials', 'materials-1k')

DRIVE = 0.70          # existing stone driveway level
ENTRY = 3.79          # villa ground floor
RISER = 0.1705        # 18 risers from forecourt to entry
GOING = 0.30
# Raycasting the north elevation (see blender/README) shows no opening between
# x -8 and x 6.4: the door at x 2.17 sits behind the rock wall and a plaster
# vestibule, so a stair on that axis climbs into a wall. x ≈ 7.3 is the only run
# that reaches the villa's own concrete terrace at z 3.79, so the pedestrian
# approach goes up the east flank and the driveway keeps the west side to itself.
STAIR_X = 7.30
STAIR_W = 3.60


def collection(name):
    existing = bpy.data.collections.get(name)
    if existing:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        return existing
    created = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(created)
    return created


SPECIMENS = []

FRONT = collection('FRONT_APPROACH')
STREET = collection('STREET')
GARDEN = collection('FRONT_GARDEN')


def put(obj, target):
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    target.objects.link(obj)


def pbr(name, folder=None, base=(.8, .78, .74, 1), roughness=.6, metallic=0.,
        scale=1., use_basecolor=True, emission=None, emission_strength=0.):
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
    if emission:
        bsdf.inputs['Emission Color'].default_value = emission
        bsdf.inputs['Emission Strength'].default_value = emission_strength
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
            normal_map.inputs['Strength'].default_value = .9
            links.new(normal_tex.outputs['Color'], normal_map.inputs['Color'])
            links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


# Large-format pale stone paving for the forecourt, dark asphalt for the road.
PAVING = pbr('KAYDAN_PAVING', 'marble_01', base=(.36, .345, .325, 1), roughness=.60, scale=5.0, use_basecolor=False)
# Three distinct stone tones. A single pale grey across paving, walls, cheeks and
# treads is what made the approach read as an untextured massing model.
STONE = pbr('KAYDAN_FRONT_STONE', 'plastered_wall_04', base=(.24, .225, .205, 1), roughness=.80, scale=3.0, use_basecolor=False)
STONE_WARM = pbr('KAYDAN_FRONT_STONE_WARM', 'plastered_wall_04', base=(.47, .43, .37, 1), roughness=.78, scale=2.6, use_basecolor=False)
TREAD = pbr('KAYDAN_TREAD', 'marble_01', base=(.66, .625, .565, 1), roughness=.50, scale=2.2, use_basecolor=False)
ASPHALT = pbr('KAYDAN_ASPHALT', 'plastered_wall_04', base=(.055, .055, .058, 1), roughness=.86, scale=9.0, use_basecolor=False)
KERB = pbr('KAYDAN_KERB', None, base=(.60, .58, .55, 1), roughness=.66)
PAINT = pbr('KAYDAN_ROADPAINT', None, base=(.82, .80, .74, 1), roughness=.7)
DARKMETAL = pbr('KAYDAN_FRONT_METAL', None, base=(.045, .045, .048, 1), roughness=.34, metallic=1.)
BRONZE = pbr('KAYDAN_BRONZE', None, base=(.36, .27, .18, 1), roughness=.3, metallic=1.)
SOIL = pbr('KAYDAN_SOIL', 'plastered_wall_04', base=(.13, .10, .07, 1), roughness=.95, scale=6.0, use_basecolor=False)
GRASS = pbr('KAYDAN_LAWN', None, base=(.115, .175, .075, 1), roughness=.94)
# Emissive lenses: the fittings must read as lit even before R3F adds a light.
WARMLENS = pbr('KAYDAN_LENS_WARM', None, base=(1, .86, .66, 1), roughness=.3,
               emission=(1, .80, .55, 1), emission_strength=9.)


def box(name, size, location, material, coll, bevel=.012, segments=2, rotation=None):
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


def cylinder(name, radius, depth, location, material, coll, vertices=24, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=vertices, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.shade_smooth()
    obj.data.materials.append(material)
    put(obj, coll)
    return obj


def clear_obstructions():
    """The scattered boulders sat squarely in the new approach and pulled the eye
    off the house; the loose planters went with them."""
    removed = 0
    SPECIMENS.clear()
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            continue
        name = obj.name
        if name.startswith('rock') or name.startswith('Plane.005_rock'):
            x, y = obj.matrix_world.translation.x, obj.matrix_world.translation.y
            # Keep the boulders that dress the pool terrace, drop the front ones.
            if y < -16.0:
                bpy.data.objects.remove(obj, do_unlink=True)
                removed += 1
        elif name.startswith('plants.00') and obj.matrix_world.translation.y < -19.0:
            bpy.data.objects.remove(obj, do_unlink=True)
            removed += 1
    # The bonsai cluster stood dead centre of the façade and hid the entrance.
    # Detaching them from the Sketchfab parent chain (keeping the world transform)
    # is what makes a move actually survive the glTF export — offsetting the child
    # alone was silently overridden by the root node.
    for obj in bpy.data.objects:
        if obj.name.startswith('Bonsai_GG') and obj.type == 'MESH':
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world
            SPECIMENS.append(obj)
    # Car into the driveway on the garage axis, nose towards the door, so the
    # vehicle route reads at a glance.
    for obj in bpy.data.objects:
        if obj.name.startswith('Porsche_911') and obj.type == 'MESH':
            world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = world
            obj.location.x += 0.35
            obj.location.y += 0.65
    print(f'removed {removed} front obstructions, kept {len(SPECIMENS)} specimen trees')


def build_forecourt():
    """A flat paved apron at driveway level, wide enough for the house to breathe."""
    box('FORECOURT', (26.0, 13.0, .18), (-1.0, -28.6, DRIVE - .09), PAVING, FRONT, bevel=0)
    # Paving joints, laid as shallow recessed lines rather than a flat plane.
    for i in range(13):
        box(f'FORECOURT_JOINT_X_{i}', (26.0, .035, .004), (-1.0, -35.0 + i * 1.05, DRIVE + .002), STONE, FRONT, bevel=0)
    for i in range(19):
        box(f'FORECOURT_JOINT_Y_{i}', (.035, 13.0, .004), (-13.5 + i * 1.4, -28.6, DRIVE + .002), STONE, FRONT, bevel=0)

    # Retaining wall holding the regraded bank, with a planted top.
    # The west retaining wall used to run right across the garage approach, so the
    # car read as parked behind a wall. It now stops short of the driveway and only
    # holds the bank west of it.
    box('RETAIN_W', (4.6, .45, 2.9), (-11.0, -22.0, DRIVE + 1.25), STONE_WARM, FRONT, bevel=.03)
    for i in range(3):
        box(f'RETAIN_W_PIER_{i}', (.34, .60, 2.9), (-12.9 + i * 1.9, -22.0, DRIVE + 1.25), STONE, FRONT, bevel=.02)
    box('RETAIN_W_BAND', (4.6, .48, .10), (-11.0, -22.0, DRIVE + 2.28), STONE, FRONT, bevel=.01)

    # Continuous vehicle route: crossover, driveway, garage threshold, all on the
    # same paving and clear of every wall.
    box('DRIVEWAY', (5.6, 7.4, .16), (-4.8, -22.6, DRIVE - .08), PAVING, FRONT, bevel=0)
    for i in range(7):
        box(f'DRIVEWAY_JOINT_{i}', (5.6, .035, .004), (-4.8, -26.0, DRIVE + .002 + 0), STONE, FRONT, bevel=0)
    box('GARAGE_THRESHOLD', (5.2, .5, .05), (-4.8, -19.1, DRIVE + .02), TREAD, FRONT, bevel=.01)
    box('RETAIN_E', (4.2, .45, 2.4), (12.3, -22.0, DRIVE + 1.0), STONE_WARM, FRONT, bevel=.03)
    box('RETAIN_W_CAP', (10.7, .62, .08), (-8.0, -22.0, DRIVE + 2.74), TREAD, FRONT, bevel=.012)
    box('RETAIN_E_CAP', (4.4, .62, .08), (12.3, -22.0, DRIVE + 2.24), TREAD, FRONT, bevel=.012)
    box('RETAIN_W_BED', (10.5, 3.4, .5), (-8.0, -20.1, DRIVE + 2.5), SOIL, FRONT, bevel=0)
    box('RETAIN_E_BED', (4.2, 3.4, .5), (12.3, -20.1, DRIVE + 2.0), SOIL, FRONT, bevel=0)
    # Terraced planters dressing the east bank, which read as raw hillside before.
    # Five continuous terraces per bank rather than three isolated planters: the
    # gaps between them were what still read as raw hillside.
    for i in range(5):
        height = .48 + i * .46
        y = -23.9 + i * 1.30
        box(f'TERRACE_E_{i}', (4.2, 1.24, height), (12.3, y, DRIVE + height / 2), STONE_WARM, FRONT, bevel=.02)
        box(f'TERRACE_E_CAP_{i}', (4.4, 1.36, .07), (12.3, y, DRIVE + height), TREAD, FRONT, bevel=.01)
        box(f'TERRACE_E_BED_{i}', (4.0, 1.10, .22), (12.3, y, DRIVE + height + .11), SOIL, FRONT, bevel=0)
    for i in range(5):
        height = .70 + i * .48
        y = -23.9 + i * 1.30
        box(f'TERRACE_W_{i}', (4.6, 1.24, height), (-11.4, y, DRIVE + height / 2), STONE_WARM, FRONT, bevel=.02)
        box(f'TERRACE_W_CAP_{i}', (4.8, 1.36, .07), (-11.4, y, DRIVE + height), TREAD, FRONT, bevel=.01)
        box(f'TERRACE_W_BED_{i}', (4.4, 1.10, .22), (-11.4, y, DRIVE + height + .11), SOIL, FRONT, bevel=0)


def build_stair():
    """Eighteen identical risers in two flights around a landing. Every tread is
    generated from the same rise and going, so nothing can drift out of line."""
    flight_a, flight_b = 9, 9
    landing_depth = 1.60
    y = -25.90                      # bottom nosing, out on the forecourt
    z = DRIVE

    def flight(count, label):
        nonlocal y, z
        for step in range(count):
            z += RISER
            y += GOING
            box(f'STEP_{label}_{step}', (STAIR_W, GOING, RISER), (STAIR_X, y - GOING / 2, z - RISER / 2),
                TREAD, FRONT, bevel=.008)
            # 12 mm nosing shadow line under each tread.
            box(f'STEP_{label}_{step}_NOSE', (STAIR_W, .02, .012), (STAIR_X, y - GOING + .01, z - .014),
                STONE, FRONT, bevel=0)

    flight(flight_a, 'A')
    landing_z = z
    box('STAIR_LANDING', (STAIR_W, landing_depth, .18), (STAIR_X, y + landing_depth / 2, landing_z - .09),
        TREAD, FRONT, bevel=.01)
    y += landing_depth
    flight(flight_b, 'B')

    top_y = y
    build_arrival(top_y)

    # Cheek walls that step with the flights. Two full-height slabs read as blank
    # masses and swallowed the middle of the composition.
    slope = math.atan2(RISER, GOING)
    for side, sign in (('W', -1), ('E', 1)):
        x = STAIR_X + sign * (STAIR_W / 2 + .14)
        z = DRIVE
        y = -25.90
        for label, count in (('A', flight_a), ('B', flight_b)):
            if label == 'B':
                y += landing_depth
                z = landing_z
            for step in range(count):
                z += RISER
                y += GOING
                box(f'CHEEK_{side}_{label}_{step}', (.28, GOING + .02, .62),
                    (x, y - GOING / 2, z + .31 - RISER), STONE, FRONT, bevel=.015)
                box(f'CHEEK_{side}_{label}_{step}_CAP', (.36, GOING + .02, .05),
                    (x, y - GOING / 2, z + .62 - RISER), TREAD, FRONT, bevel=.01)
            if label == 'A':
                box(f'CHEEK_{side}_LANDING', (.28, landing_depth, .62),
                    (x, y + landing_depth / 2, z + .31), STONE, FRONT, bevel=.015)
                box(f'CHEEK_{side}_LANDING_CAP', (.36, landing_depth, .05),
                    (x, y + landing_depth / 2, z + .62), TREAD, FRONT, bevel=.01)

        # Recessed step lights washing the treads.
        for i in range(5):
            box(f'STEPLIGHT_{side}_{i}', (.09, .15, .045),
                (x - sign * .21, -25.3 + i * 1.55, DRIVE + .40 + i * .70), WARMLENS, FRONT, bevel=.008)


def build_arrival(top_y):
    """Arrival terrace at the head of the stair, then a designed walk south along
    the east flank to the south sliding bay — which raycasting showed is the only
    real way in. The bay is now treated as the entrance, so the route is composed
    rather than improvised: a platform to arrive on, a gentle turn, a walk with a
    lit parapet on one side and planting on the other, ending at a lit threshold."""
    box('ARRIVAL_DECK', (5.4, 3.4, .2), (STAIR_X, top_y + 1.6, ENTRY - .1), TREAD, FRONT, bevel=.012)
    box('ARRIVAL_BAND', (5.4, .12, .03), (STAIR_X, top_y + 3.24, ENTRY + .01), STONE, FRONT, bevel=0)
    box('ARRIVAL_PARAPET', (.34, 3.4, 1.02), (STAIR_X + 2.55, top_y + 1.6, ENTRY + .51), STONE_WARM, FRONT, bevel=.02)
    box('ARRIVAL_PARAPET_CAP', (.46, 3.5, .07), (STAIR_X + 2.55, top_y + 1.6, ENTRY + 1.05), TREAD, FRONT, bevel=.012)
    box('ARRIVAL_PARAPET_LED', (.05, 3.2, .06), (STAIR_X + 2.36, top_y + 1.6, ENTRY + .86), WARMLENS, FRONT, bevel=.008)
    box('ARRIVAL_PLANTER', (1.15, 3.3, .55), (STAIR_X - 2.35, top_y + 1.6, ENTRY + .18), STONE_WARM, FRONT, bevel=.02)
    box('ARRIVAL_PLANTER_CAP', (1.28, 3.42, .07), (STAIR_X - 2.35, top_y + 1.6, ENTRY + .49), TREAD, FRONT, bevel=.012)
    box('ARRIVAL_PLANTER_SOIL', (1.0, 3.15, .18), (STAIR_X - 2.35, top_y + 1.6, ENTRY + .40), SOIL, FRONT, bevel=0)

    walk_x = 8.35
    box('WALK_DECK', (2.4, 10.4, .18), (walk_x, -12.4, ENTRY - .09), TREAD, FRONT, bevel=.01)
    box('WALK_PARAPET', (.32, 10.4, 1.0), (walk_x + 1.36, -12.4, ENTRY + .50), STONE_WARM, FRONT, bevel=.02)
    box('WALK_PARAPET_CAP', (.44, 10.5, .07), (walk_x + 1.36, -12.4, ENTRY + 1.03), TREAD, FRONT, bevel=.012)
    box('WALK_PARAPET_LED', (.05, 10.1, .06), (walk_x + 1.18, -12.4, ENTRY + .84), WARMLENS, FRONT, bevel=.008)
    box('WALK_PLANTER', (.95, 10.2, .5), (walk_x - 1.62, -12.4, ENTRY + .16), STONE_WARM, FRONT, bevel=.02)
    box('WALK_PLANTER_CAP', (1.06, 10.3, .07), (walk_x - 1.62, -12.4, ENTRY + .44), TREAD, FRONT, bevel=.012)
    box('WALK_PLANTER_SOIL', (.82, 10.0, .18), (walk_x - 1.62, -12.4, ENTRY + .36), SOIL, FRONT, bevel=0)
    for i in range(7):
        box(f'WALK_UPLIGHT_{i}', (.10, .10, .04), (walk_x - 1.0, -16.8 + i * 1.5, ENTRY + .02), WARMLENS, FRONT, bevel=.008)

    box('APPROACH_DECK', (13.4, 2.4, .18), (2.4, -7.3, ENTRY - .09), TREAD, FRONT, bevel=.01)
    for i in range(9):
        box(f'APPROACH_UPLIGHT_{i}', (.10, .10, .04), (7.8 - i * 1.4, -6.4, ENTRY + .02), WARMLENS, FRONT, bevel=.008)

    bay_x = -3.75
    box('BAY_THRESHOLD', (2.5, .5, .05), (bay_x, -8.25, ENTRY + .025), STONE, FRONT, bevel=.01)
    box('BAY_CANOPY', (3.2, 1.1, .12), (bay_x, -7.9, ENTRY + 2.78), STONE_WARM, FRONT, bevel=.02)
    for i, x in enumerate((bay_x - 1.9, bay_x + 1.9)):
        box(f'BAY_PLANTER_{i}', (.85, 1.4, .62), (x, -7.5, ENTRY + .31), STONE_WARM, FRONT, bevel=.02)
        box(f'BAY_PLANTER_CAP_{i}', (.96, 1.5, .07), (x, -7.5, ENTRY + .65), TREAD, FRONT, bevel=.012)
        box(f'BAY_PLANTER_SOIL_{i}', (.72, 1.25, .16), (x, -7.5, ENTRY + .56), SOIL, FRONT, bevel=0)
        box(f'BAY_SCONCE_{i}', (.09, .09, .32), (x, -8.5, ENTRY + 2.05), WARMLENS, FRONT, bevel=.01)
    for i in range(4):
        box(f'BAY_DOWNLIGHT_{i}', (.10, .10, .035), (bay_x - 1.05 + i * .7, -7.9, ENTRY + 2.70), WARMLENS, FRONT, bevel=.008)


def build_road():
    """The property finally reads from the street: carriageway, kerb, verge."""
    box('ROAD', (54.0, 7.4, .10), (-1.0, -38.6, DRIVE - .16), ASPHALT, STREET, bevel=0)
    box('ROAD_CENTRE', (54.0, .12, .004), (-1.0, -38.6, DRIVE - .105), PAINT, STREET, bevel=0)
    box('KERB', (54.0, .32, .30), (-1.0, -34.8, DRIVE - .06), KERB, STREET, bevel=.02)
    box('KERB_FAR', (54.0, .32, .30), (-1.0, -42.4, DRIVE - .06), KERB, STREET, bevel=.02)
    box('VERGE', (54.0, 1.5, .12), (-1.0, -33.9, DRIVE - .06), GRASS, STREET, bevel=0)
    # Crossover apron into the property.
    box('CROSSOVER', (7.6, 1.9, .12), (2.0, -34.0, DRIVE - .06), PAVING, STREET, bevel=0)


def build_gate_and_fence():
    """Boundary wall with slatted infill and a wide sliding gate on the axis."""
    y = -33.0
    gate_x0, gate_x1 = -1.9, 5.9

    def pier(name, x, height=2.5, width=.62):
        box(name, (width, .62, height), (x, y, DRIVE + height / 2), STONE_WARM, STREET, bevel=.02)
        box(f'{name}_CAP', (width + .14, .76, .09), (x, y, DRIVE + height + .045), TREAD, STREET, bevel=.012)
        box(f'{name}_LIGHT', (.09, .09, .34), (x + .0, y - .34, DRIVE + height - .55), WARMLENS, STREET, bevel=.01)

    pier('PIER_GATE_W', gate_x0)
    pier('PIER_GATE_E', gate_x1)
    pier('PIER_END_W', -13.4)
    pier('PIER_END_E', 11.4)

    # Slatted gate leaves.
    for leaf, (x0, x1) in enumerate(((gate_x0 + .31, 1.95), (1.95, gate_x1 - .31))):
        width = x1 - x0
        box(f'GATE_FRAME_{leaf}', (width, .09, 2.15), ((x0 + x1) / 2, y, DRIVE + 1.1), DARKMETAL, STREET, bevel=.01)
        count = max(4, int(width / .17))
        for i in range(count):
            box(f'GATE_SLAT_{leaf}_{i}', (.075, .13, 2.02),
                (x0 + .09 + i * (width - .18) / max(1, count - 1), y, DRIVE + 1.1), BRONZE, STREET, bevel=.008)

    # Boundary walls with the same slatted rhythm above a solid base.
    for side, (x0, x1) in (('W', (-13.1, gate_x0 - .31)), ('E', (gate_x1 + .31, 11.1))):
        width = x1 - x0
        box(f'FENCE_BASE_{side}', (width, .34, 1.0), ((x0 + x1) / 2, y, DRIVE + .5), STONE_WARM, STREET, bevel=.02)
        box(f'FENCE_CAP_{side}', (width, .46, .07), ((x0 + x1) / 2, y, DRIVE + 2.28), TREAD, STREET, bevel=.01)
        count = int(width / .21)
        for i in range(count):
            box(f'FENCE_SLAT_{side}_{i}', (.065, .11, 1.28),
                (x0 + .12 + i * (width - .24) / max(1, count - 1), y, DRIVE + 1.64), BRONZE, STREET, bevel=.006)

    box('INTERCOM', (.16, .09, .34), (gate_x1 + .05, y - .38, DRIVE + 1.35), DARKMETAL, STREET, bevel=.015)


def build_landscaping():
    """Structured beds, hedges and specimen trees instead of bare slope."""
    # Lawn panels and planted beds flanking the stair.
    box('LAWN_W', (8.6, 5.6, .06), (-7.6, -27.0, DRIVE + .04), GRASS, GARDEN, bevel=0)
    box('LAWN_E', (4.0, 5.6, .06), (12.4, -27.0, DRIVE + .04), GRASS, GARDEN, bevel=0)
    box('BED_STAIR_W', (1.7, 7.4, .34), (4.15, -23.4, DRIVE + .17), SOIL, GARDEN, bevel=.02)
    box('BED_STAIR_E', (1.7, 7.4, .34), (10.45, -23.4, DRIVE + .17), SOIL, GARDEN, bevel=.02)
    box('BED_STAIR_W_EDGE', (1.82, 7.5, .06), (4.15, -23.4, DRIVE + .35), TREAD, GARDEN, bevel=.01)
    box('BED_STAIR_E_EDGE', (1.82, 7.5, .06), (10.45, -23.4, DRIVE + .35), TREAD, GARDEN, bevel=.01)

    # Clipped hedges: low horizontal masses that settle the composition.
    for i in range(9):
        box(f'HEDGE_W_{i}', (.95, .95, .70), (-11.6 + (i % 3) * .0, -31.2 + i * .98, DRIVE + .35),
            GRASS, GARDEN, bevel=.16, segments=3)
    for i in range(7):
        box(f'HEDGE_E_{i}', (.95, .95, .70), (10.2, -30.4 + i * .98, DRIVE + .35), GRASS, GARDEN, bevel=.16, segments=3)

    # Specimen trees: the villa's own bonsais, re-sited so they frame the house
    # instead of standing in front of the door.
    spots = [(-11.6, -24.2, 1.00), (-9.8, -30.6, .84), (11.2, -25.0, .95),
             (9.8, -31.2, .78), (-13.6, -20.8, .88), (9.4, -21.4, .70)]
    for index, tree in enumerate(SPECIMENS):
        x, y, scale = spots[index % len(spots)]
        tree.location = Vector((x, y, DRIVE - .35))
        tree.rotation_euler = (0, 0, math.radians(53 * index))
        tree.scale = (scale, scale, scale)
        put(tree, GARDEN)
    # Extra copies so both banks read as planted rather than mown.
    if SPECIMENS:
        donor = SPECIMENS[0]
        for index, (x, y, scale) in enumerate(spots[len(SPECIMENS):] + [(-6.6, -32.4, .62), (5.8, -32.4, .58)]):
            copy = donor.copy()
            copy.data = donor.data.copy()
            copy.name = f'FRONT_TREE_{index}'
            copy.location = Vector((x, y, DRIVE - .35))
            copy.rotation_euler = (0, 0, math.radians(41 * index + 17))
            copy.scale = (scale, scale, scale)
            bpy.context.scene.collection.objects.link(copy)
            put(copy, GARDEN)

    # No box-shrubs on the banks: rounded cubes at that size render as green
    # blocks floating over the slope, which is worse than bare ground. The banks
    # are planted with real trees on the retaining beds, whose top level is known,
    # so nothing hovers.
    bed_w_top = DRIVE + 2.5 + .25
    bed_e_top = DRIVE + 2.0 + .25
    bank_spots = [
        (-11.0, -20.4, .74, bed_w_top), (-8.2, -20.0, .62, bed_w_top),
        (-5.4, -20.6, .68, bed_w_top), (-12.8, -19.6, .58, bed_w_top),
        (9.2, -20.2, .66, bed_e_top), (7.4, -20.8, .56, bed_e_top),
        (10.8, -19.8, .60, bed_e_top),
    ]
    if SPECIMENS:
        donor = SPECIMENS[0]
        for index, (x, y, scale, top) in enumerate(bank_spots):
            copy = donor.copy()
            copy.data = donor.data.copy()
            copy.name = f'BANK_TREE_{index}'
            copy.location = Vector((x, y, top - .30))
            copy.rotation_euler = (0, 0, math.radians(37 * index + 11))
            copy.scale = (scale, scale, scale)
            bpy.context.scene.collection.objects.link(copy)
            put(copy, GARDEN)

    # Foundation planting where the bank meets the building. Between the top
    # terrace (y -18.7) and the villa slab (y -19) a strip of mown grass was still
    # showing through on the right of the hero.
    for side, (x0, x1) in (('E', (4.35, 12.0)), ('W', (-12.4, -0.15))):
        width = x1 - x0
        cx = (x0 + x1) / 2
        box(f'FOUND_WALL_{side}', (width, .30, 1.55), (cx, -18.55, DRIVE + .78), STONE_WARM, FRONT, bevel=.02)
        box(f'FOUND_CAP_{side}', (width + .12, .40, .07), (cx, -18.55, DRIVE + 1.56), TREAD, FRONT, bevel=.01)
        box(f'FOUND_BED_{side}', (width - .2, 2.1, .5), (cx, -17.4, DRIVE + 1.30), SOIL, FRONT, bevel=0)

    # Ground cover on the terrace beds, from the villa's own calathea clump so the
    # planting matches the rest of the garden.
    covers = [o for o in bpy.data.objects if o.name.startswith('calathea_orbifolia') and o.type == 'MESH']
    # Smallest clump first: it is the cheapest to repeat and reads best massed.
    covers.sort(key=lambda o: len(o.data.polygons))
    if covers:
        donor = covers[0]
        placed = 0
        for bank, (bx, span) in (('E', (12.3, 4.0)), ('W', (-11.4, 4.4))):
            for i in range(5):
                height = (.48 if bank == 'E' else .70) + i * (.46 if bank == 'E' else .48)
                y = -23.9 + i * 1.30
                for j in range(22):
                    copy = donor.copy()
                    copy.data = donor.data.copy()
                    copy.name = f'COVER_{bank}_{i}_{j}'
                    copy.location = Vector((bx - span / 2 + .45 + j * (span - .9) / 21,
                                            y + ((j % 5) - 2) * .21, DRIVE + height + .2))
                    copy.rotation_euler = (0, 0, math.radians(63 * j + 29 * i))
                    scale = 3.6 + ((i * 5 + j * 3) % 7) * .55
                    copy.scale = (scale, scale, scale)
                    bpy.context.scene.collection.objects.link(copy)
                    put(copy, GARDEN)
                    placed += 1
        # Plus a run along the foundation beds.
        for side, (x0, x1) in (('E', (4.6, 11.7)), ('W', (-12.1, -0.4))):
            count = max(4, int((x1 - x0) / .38))
            for k in range(count):
                copy = donor.copy()
                copy.data = donor.data.copy()
                copy.name = f'FOUND_COVER_{side}_{k}'
                copy.location = Vector((x0 + (x1 - x0) * k / max(1, count - 1),
                                        -17.4 + ((k % 5) - 2) * .34, DRIVE + 1.52))
                copy.rotation_euler = (0, 0, math.radians(51 * k + 13))
                scale = 3.8 + ((k * 7) % 6) * .7
                copy.scale = (scale, scale, scale)
                bpy.context.scene.collection.objects.link(copy)
                put(copy, GARDEN)
                placed += 1
        print(f'ground cover: {placed} plants')

    # Layered planting: low cover at the front of each bed, a taller clump behind.
    beds = []
    for side, sign in (('W', -1), ('E', 1)):
        for i in range(6):
            beds.append((STAIR_X + sign * 3.70, -25.4 + i * 1.25, DRIVE + .45 + i * .52, 2.0))
    beds.append((STAIR_X - 2.35, -17.2, ENTRY + .50, 3.1))
    beds.append((8.35 - 1.62, -12.4, ENTRY + .46, 10.0))
    beds.append((-5.65, -7.5, ENTRY + .72, 1.2))
    beds.append((-1.85, -7.5, ENTRY + .72, 1.2))
    if covers:
        small, big = covers[0], covers[-1]
        grown = 0
        for bi, (bx, by, bz, span) in enumerate(beds):
            count = max(3, int(span / .45))
            for k in range(count):
                donor = small if k % 3 else big
                copy = donor.copy()
                copy.data = donor.data.copy()
                copy.name = f'BEDPLANT_{bi}_{k}'
                copy.location = Vector((bx + ((k % 3) - 1) * .28,
                                        by - span / 2 + .25 + k * (span - .5) / max(1, count - 1), bz))
                copy.rotation_euler = (0, 0, math.radians(59 * k + 31 * bi))
                scale = (2.1 if k % 3 else 3.2) + ((bi * 3 + k) % 5) * .35
                copy.scale = (scale, scale, scale)
                bpy.context.scene.collection.objects.link(copy)
                put(copy, GARDEN)
                grown += 1
        print(f'bed planting: {grown}')

    # Bollard uplights along the crossover and forecourt edge.
    for index, (x, y) in enumerate(((-2.6, -31.4), (9.6, -31.4), (-7.6, -26.4), (10.2, -26.4), (-9.4, -24.0), (4.6, -27.4))):
        cylinder(f'BOLLARD_{index}', .055, .62, (x, y, DRIVE + .31), DARKMETAL, GARDEN, vertices=14)
        box(f'BOLLARD_LENS_{index}', (.09, .045, .10), (x, y - .05, DRIVE + .55), WARMLENS, GARDEN, bevel=.01)


def build_facade_lighting():
    """Fittings on the façade itself: wall washers, soffit downlights, uplights at
    the stone pier. The reference reads as architecture because the light does."""
    for index, (x, y, z) in enumerate(((3.6, -16.6, 5.5), (-1.1, -16.9, 5.5), (5.4, -15.4, 5.5))):
        box(f'WALLWASH_{index}', (.10, .10, .28), (x, y, z), DARKMETAL, FRONT, bevel=.012)
        box(f'WALLWASH_LENS_{index}', (.075, .075, .04), (x, y - .06, z - .15), WARMLENS, FRONT, bevel=.006)
    for index, (x, y) in enumerate(((1.2, -17.1), (2.9, -17.1), (4.4, -16.2), (-0.4, -17.1))):
        box(f'UPLIGHT_{index}', (.13, .13, .05), (x, y, ENTRY + .03), WARMLENS, FRONT, bevel=.01)
    for index, (x, y) in enumerate(((.6, -14.4), (3.7, -14.4))):
        cylinder(f'SOFFIT_{index}', .065, .04, (x, y, 6.72), WARMLENS, FRONT, vertices=16)


clear_obstructions()
build_forecourt()
build_stair()
build_road()
build_gate_and_fence()
build_landscaping()
build_facade_lighting()

blend_out = os.path.join(ROOT, 'blender', 'kaydan-villa-production.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend_out)

glb_out = os.path.join(ROOT, 'assets-source', 'models', 'kaydan-villa-production.glb')
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
print(f'FRONT APPROACH BUILT -> {glb_out}')
