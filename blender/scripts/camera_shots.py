"""The visit's camera compositions, authored and validated in Blender.

Every room is framed like a property photographer would: an overview that
answers "which room am I in?", then one to three focus shots on the pieces that
matter (sofa, island, bed, bathtub…), each aimed at a named TARGET_ anchor
placed on the real furniture. Waypoints between shots and rooms follow real
passages — through the front door, along the corridor, up the stair, through
the doorways — never through a wall.

The script
  * places TARGET_* empties on the furniture (bounding-box centres of named
    objects, so moving a sofa moves its shots) and a CAM_<ROOM>_<SHOT> camera
    per shot, in the CAMERA_SHOTS collection, for visual tuning in Blender;
  * validates every shot (camera clearance, target visible) and every leg of
    the path (no wall crossed), and prints a report;
  * derives a mobile framing per shot (pulled back along the view while the
    room allows it, wider lens for the portrait frame);
  * writes src/experience/tourShots.ts for the browser.

    blender -b blender/kaydan-villa-production.blend --python blender/scripts/camera_shots.py

Coordinates are glTF (x, y up, z towards the road): Blender (x, -z, y).
"""

import math
import os
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_TS = os.path.join(ROOT, 'src', 'experience', 'tourShots.ts')
BLEND_OUTPUT = os.path.join(ROOT, 'blender', 'kaydan-villa-production.blend')

GF, UP = 3.789, 6.90


def B(x, y, z):
    return Vector((x, -z, y))


def G(v):
    return (v.x, v.z, -v.y)


# ── anchors: what each shot looks at ─────────────────────────────────────────
# name → object-name prefixes (bounding-box centre) or an explicit point,
# plus an optional offset.
ANCHORS = {
    'VILLA': (1.4, 5.6, 17.0),
    'FACADE_FRAME': (4.225, 7.6, 19.05),
    'CARPORT': (-5.4, 2.0, 20.0),
    'MAIN_STAIR': (4.225, 4.85, 16.3),
    'ENTRY_DOOR': (['ENTRY_DOOR'], (0, -.1, 0)),
    'HALL_VESTIBULE': (5.9, 4.9, 13.9),
    'HALL_CONSOLE': (['Hall_Art_Console'], (-.1, -.25, 0)),
    'HALL_ART': (['Hall_Art_Entry'], (0, -.1, 0)),
    'LIVING_ROOM': (-2.0, 4.4, 11.15),
    'LIVING_SOFA': (['Living_Sofa_Main', 'Living_Armchair_South', 'Living_Armchair_North'], (0, -.05, 0)),
    'LIVING_FIREPLACE_ART': (-.4, 4.85, 11.3),
    'DINING_ROOM': (-6.6, 4.6, 10.7),
    'DINING_TABLE': (['Dining_Table'], (0, .1, 0)),
    'KITCHEN_ISLAND': (-5.4, 4.55, 13.8),
    'KITCHEN_FAUCET': (['Kitchen_Faucet'], (0, -.05, 0)),
    'STAIR': (.9, 5.9, 15.0),
    'STAIR_TREADS': (1.25, 6.1, 14.6),
    'MASTER_SUITE': (-4.9, 7.55, 10.9),
    'MASTER_BED': (['BED_HEADBOARD', 'BED_MATTRESS', 'Master_Art'], (0, -.2, 0)),
    'MASTER_ARMCHAIR': (['Master_Armchair', 'SIDE_TABLE_TOP'], (0, 0, 0)),
    'BATHROOM': (-5.9, 7.6, 14.6),
    'BATH_TUB': (['BATH_TUB'], (0, .05, 0)),
    'BATH_SHOWER': (['BATH_SHOWER_TRAY', 'BATH_RAIN_HEAD'], (0, 0, 0)),
    'BATH_VANITY': (['BATH_VANITY', 'BATH_MIRROR'], (0, 0, 0)),
    'BEDROOM': (3.55, 7.45, 11.0),
    'BEDROOM_BED': (['BED2_HEADBOARD', 'BED2_MATTRESS', 'Bed2_Art'], (0, -.2, 0)),
    'TERRACE_LOUNGE': (['Terrace_Sofa', 'Terrace_CoffeeTable', 'Terrace_Armchair'], (0, 0, 0)),
    'TERRACE': (1.6, 4.7, 7.4),
    'POOL': (.5, 5.4, 6.0),
    'POOL_SUNBEDS': (5.6, 3.9, 3.6),
    'GARDEN': (1.5, 3.4, 21.0),
    'GARDEN_TIERS': (2.6, 2.0, 23.6),
    'AERIAL': (1.0, 5.2, 7.0),
}

# ── rooms: approach waypoints, then shots ────────────────────────────────────
# Waypoints: (position, target point or anchor, fov). Shots: dict.
def shot(name, position, subject, fov, hold=1.0, note='', via=()):
    """`via`: waypoints walked before this shot, inside the same room."""
    return {'shot': name, 'position': position, 'subject': subject, 'fov': fov, 'hold': hold, 'note': note, 'via': list(via)}


ROOMS = [
    ('exterior', [], [
        shot('overview', (10.0, 2.75, 31.7), 'VILLA', 50, 1.3, 'villa, escalier, porte, accès voiture, jardin'),
        shot('facade', (4.225, 3.3, 27.4), 'FACADE_FRAME', 40, 1.0, 'cadre de l’étage, balcon, matériaux'),
        shot('carport', (-1.2, 2.3, 28.6), 'CARPORT', 40, .9, 'carport, porte à lames bronze'),
    ]),
    ('entrance', [
        ((1.6, 2.4, 30.0), (4.225, 4.2, 18.0), 46),
    ], [
        shot('overview', (4.225, 2.45, 27.4), 'MAIN_STAIR', 46, 1.2, 'escalier dans l’axe, porche, porte'),
        # Up the stair: 2 × 9 risers, the eye 1.6 m above the treads.
        shot('door', (4.225, 5.3, 19.05), 'ENTRY_DOOR', 48, 1.0, 'porte pivotante, poignée, éclairage', via=[
            ((4.225, 3.55, 23.8), (4.225, 5.0, 16.3), 44),
            ((4.225, 4.75, 20.9), (4.225, 5.2, 16.3), 42),
        ]),
    ]),
    ('visitor', [
        # Through the front door — it pivots open on this leg (tour.ts).
        ((4.0, 5.35, 17.4), (4.0, 5.3, 14.0), 44),
        ((3.95, 5.35, 15.7), (5.4, 5.0, 13.8), 48),
    ], [
        shot('overview', (3.45, 5.38, 14.75), 'HALL_CONSOLE', 50, 1.2, 'console chêne, toile, céramiques, plante'),
        shot('art', (4.75, 5.3, 15.2), 'HALL_ART', 42, 1.0, 'toile face à la porte, passage vers le séjour'),
    ]),
    ('living', [
        # Along the corridor, round the fireplace's north end, then down its
        # west side — the east side is closed by the hall's wall and a plant.
        ((4.3, 5.35, 13.1), (0.0, 5.0, 12.9), 50),
        ((2.2, 5.35, 13.05), (-1.0, 5.0, 12.6), 50),
        ((0.0, 5.35, 13.0), (-1.6, 4.7, 11.0), 50),
        ((-0.25, 5.35, 12.0), (-1.8, 4.5, 10.6), 50),
        ((0.05, 5.32, 10.0), (-2.0, 4.4, 11.0), 50),
    ], [
        shot('overview', (0.4, 5.3, 9.2), 'LIVING_ROOM', 50, 1.3, 'canapé, fauteuils, table basse, tapis, cheminée, baies'),
        shot('sofa', (-0.3, 5.1, 10.4), 'LIVING_SOFA', 36, 1.0, 'canapé bouclé et fauteuils lounge'),
        shot('details', (-3.95, 5.15, 9.95), 'LIVING_FIREPLACE_ART', 38, 1.0, 'table basse, céramiques, toile sur la cheminée', via=[
            ((-1.9, 5.25, 9.15), (-2.9, 4.6, 10.4), 44),
        ]),
    ]),
    ('dining', [
        ((-3.9, 5.25, 10.4), 'DINING_ROOM', 46),
    ], [
        shot('overview', (-3.55, 5.35, 11.05), 'DINING_ROOM', 48, 1.2, 'table, chaises, suspension, toile sur la pierre'),
        shot('table', (-4.55, 5.05, 9.7), 'DINING_TABLE', 34, 1.0, 'centre de table, chaises'),
    ]),
    ('kitchen', [], [
        shot('overview', (-4.7, 5.35, 11.3), 'KITCHEN_ISLAND', 48, 1.2, 'îlot, tabourets, rangements'),
        shot('island', (-3.85, 5.1, 12.35), 'KITCHEN_ISLAND', 34, 1.0, 'îlot et tabourets cuir'),
        shot('faucet', (-4.95, 5.05, 12.8), 'KITCHEN_FAUCET', 28, .9, 'robinetterie laiton, plan de travail'),
    ]),
    ('circulation', [
        ((-3.6, 5.35, 11.9), (-1.0, 5.2, 12.3), 50),
        ((-1.75, 5.35, 11.8), (0.9, 5.6, 14.5), 50),
    ], [
        shot('overview', (-0.25, 5.4, 12.0), 'STAIR', 50, 1.1, 'escalier suspendu, marches chêne, garde-corps verre'),
        # The climb: up the west flight to the half landing.
        shot('treads', (0.75, 6.8, 16.3), 'STAIR_TREADS', 40, .8, 'marches, garde-corps, lumière', via=[
            ((0.45, 5.45, 13.25), (0.45, 6.4, 16.0), 50),
            ((0.45, 6.25, 14.6), (0.6, 6.8, 16.6), 50),
        ]),
    ]),
    ('suite', [
        # Up the east flight, onto the gallery, through the west doorway of the
        # landing, into the suite.
        ((1.25, 7.65, 14.8), (1.2, 8.3, 11.5), 50),
        ((1.3, 8.45, 13.15), (-1.0, 8.2, 13.0), 50),
        ((-1.1, 8.45, 13.12), (-1.1, 8.2, 11.0), 50),
        ((-1.1, 8.45, 12.2), (-3.0, 8.0, 11.5), 50),
        ((-1.25, 8.45, 11.5), (-4.5, 8.0, 11.0), 50),
    ], [
        shot('overview', (-2.4, 8.45, 9.3), 'MASTER_SUITE', 50, 1.3, 'lit, tête de lit, chevets, tapis, fauteuil, rideaux', via=[
            ((-2.55, 8.45, 11.45), (-4.6, 7.8, 10.4), 50),
        ]),
        shot('bed', (-2.75, 8.25, 10.25), 'MASTER_BED', 38, 1.0, 'lit, tête de lit, chevets, toile'),
        shot('armchair', (-3.55, 8.35, 9.2), 'MASTER_ARMCHAIR', 38, .9, 'banc, fauteuil de lecture, rideaux, plante'),
    ]),
    ('bathroom', [
        ((-2.55, 8.45, 11.45), (-1.2, 8.2, 12.3), 50),
        ((-1.1, 8.45, 12.2), (-1.1, 8.2, 13.2), 50),
        ((-1.2, 8.45, 13.12), (-4.0, 8.0, 13.2), 50),
    ], [
        shot('overview', (-3.25, 8.5, 12.95), 'BATHROOM', 56, 1.2, 'baignoire îlot, douche, double vasque'),
        shot('tub', (-4.6, 8.25, 13.55), 'BATH_TUB', 38, 1.0, 'baignoire îlot, marbre'),
        shot('shower', (-5.3, 8.35, 14.85), 'BATH_SHOWER', 44, .9, 'douche à l’italienne, robinetterie'),
        shot('vanity', (-5.35, 8.3, 14.55), 'BATH_VANITY', 40, .9, 'double vasque, miroir, accessoires'),
    ]),
    ('bedroom', [
        # Out of the bathroom through its doorway, north of the wall return
        # at z 12.82, before turning onto the gallery.
        ((-3.4, 8.45, 13.35), (-1.0, 8.2, 13.15), 50),
        ((-2.3, 8.45, 13.15), (0.0, 8.2, 13.1), 50),
        ((-0.26, 8.45, 13.12), (-0.26, 8.2, 11.5), 50),
        ((-0.2, 8.45, 12.1), (1.6, 8.1, 9.8), 50),
        ((1.5, 8.45, 9.65), (3.5, 8.0, 10.6), 50),
    ], [
        shot('overview', (2.5, 8.45, 9.25), 'BEDROOM', 54, 1.2, 'lit, chevet, fenêtre et voilages, toile'),
        shot('bed', (4.05, 8.35, 9.2), 'BEDROOM_BED', 42, .9, 'lit, tête de lit, toile'),
    ]),
    ('terrace', [
        ((2.5, 8.45, 9.65), (1.0, 8.0, 9.8), 50),
        ((1.5, 8.45, 9.65), (-0.2, 8.2, 12.6), 50),
        ((-0.2, 8.45, 12.1), (-0.26, 8.2, 13.4), 50),
        ((-0.26, 8.45, 13.12), (1.4, 8.0, 13.6), 50),
        ((1.3, 8.45, 13.2), (1.25, 7.0, 15.4), 50),
        ((1.25, 7.65, 14.8), (0.8, 6.6, 16.5), 50),
        ((0.75, 6.8, 16.3), (0.45, 5.2, 14.0), 50),
        ((0.45, 6.2, 14.6), (0.45, 5.3, 12.6), 50),
        ((0.45, 5.45, 13.25), (-0.4, 5.1, 11.0), 50),
        ((-0.25, 5.35, 12.0), (0.2, 5.1, 9.0), 50),
        # Out through the slid-open bay door (furnish_interiors.py).
        ((0.0, 5.32, 9.9), (-0.3, 5.1, 7.0), 50),
        ((-0.3, 5.3, 9.0), (-0.3, 5.0, 5.0), 50),
        ((-0.3, 5.3, 7.4), (2.2, 4.4, 5.0), 50),
    ], [
        shot('overview', (3.4, 5.3, 2.7), 'TERRACE', 50, 1.2, 'salon extérieur, façade, piscine'),
        shot('lounge', (0.2, 4.95, 5.2), 'TERRACE_LOUNGE', 36, 1.0, 'canapé, fauteuils, table basse teck'),
    ]),
    ('pool', [
        ((4.6, 5.0, 0.6), (1.0, 5.2, 6.0), 48),
    ], [
        shot('overview', (7.6, 4.8, -2.8), 'POOL', 48, 1.3, 'piscine, villa en arrière-plan'),
        shot('water', (2.6, 4.45, 1.0), 'POOL_SUNBEDS', 36, 1.0, 'eau, margelles, transats'),
    ]),
    ('garden', [
        ((-2.0, 7.5, -4.5), (-6.0, 5.0, 6.0), 50),
        ((-13.0, 8.5, 2.0), (-6.0, 4.0, 18.0), 50),
        ((-15.5, 7.5, 17.0), (-2.0, 3.5, 24.0), 50),
        ((-12.5, 4.5, 29.0), (0.0, 3.4, 22.0), 50),
    ], [
        shot('overview', (-9.5, 2.7, 30.5), 'GARDEN', 50, 1.2, 'pelouse, gradins plantés, palmiers, villa'),
        shot('tiers', (-0.2, 2.2, 28.4), 'GARDEN_TIERS', 36, 1.0, 'gradins plantés, agaves, éclairage'),
    ]),
    ('finale', [
        # Rising round the west side, out over the hillside to the south-west.
        ((-12.0, 7.5, 30.0), (-4.0, 4.0, 18.0), 48),
        ((-18.0, 9.5, 12.0), (-4.0, 5.0, 8.0), 46),
        ((-16.0, 10.5, -6.0), (0.0, 5.2, 6.0), 44),
    ], [
        shot('overview', (-13.5, 10.5, -13.5), 'AERIAL', 42, 2.6, 'villa, terrasse, piscine, ciel'),
    ]),
]


# ── geometry queries ─────────────────────────────────────────────────────────
DG = None


def ray(origin, direction, distance=200.0, skip_glass=True):
    """First hit from origin (glTF) along direction (glTF), skipping glass,
    curtains and the camera rig itself."""
    o = B(*origin)
    d = Vector((direction[0], -direction[2], direction[1])).normalized()
    travelled = 0.0
    while travelled < distance:
        ok, loc, normal, index, obj, matrix = bpy.context.scene.ray_cast(DG, o, d, distance=distance - travelled)
        if not ok:
            return None
        mats = [s.material.name for s in obj.material_slots if s.material] if obj else []
        passable = skip_glass and (any('Glass' in m or 'GLASS' in m or m == 'KAYDAN_SHEER' for m in mats) or obj.name.startswith(('CAM_', 'ENTRY_DOOR')))
        if not passable:
            return travelled + (loc - o).length, obj
        step = (loc - o).length + .01
        travelled += step
        o = loc + d * .01
    return None


def anchor_point(name):
    spec = ANCHORS[name]
    if isinstance(spec[0], (int, float)):
        return Vector(spec)
    prefixes, offset = spec
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    found = False
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and any(obj.name.startswith(p) for p in prefixes):
            for c in obj.bound_box:
                g = Vector(G(obj.matrix_world @ Vector(c)))
                lo = Vector((min(lo[i], g[i]) for i in range(3)))
                hi = Vector((max(hi[i], g[i]) for i in range(3)))
                found = True
    if not found:
        raise RuntimeError(f'anchor {name}: no object starting with {prefixes}')
    return (lo + hi) / 2 + Vector(offset)


def clearance(p):
    best = 99.0
    for a in range(8):
        hit = ray(p, (math.cos(a * math.pi / 4), 0, math.sin(a * math.pi / 4)), 5.0, skip_glass=False)
        if hit:
            best = min(best, hit[0])
    return best


def target_blocked(p, t, prefixes):
    d = Vector(t) - Vector(p)
    hit = ray(p, d, d.length)
    if not hit:
        return None
    dist, obj = hit
    if dist >= d.length - .4:
        return None
    if prefixes and any(obj.name.startswith(x) for x in prefixes):
        return None
    return obj.name


def leg_blocked(a, b):
    d = Vector(b) - Vector(a)
    if d.length < 1e-4:
        return None
    hit = ray(a, d, d.length)
    return hit[1].name if hit else None


def mobile_framing(p, t, fov, neighbours):
    """Portrait frames crop the sides: widen the lens and back off along the
    view — but only as far as the room allows, keeping a clearance around the
    camera and clear legs to the neighbouring stops (doorways!)."""
    p, t = Vector(p), Vector(t)
    back = (p - t).normalized()
    for step in (.9, .6, .35, .0):
        mp = p + back * step
        if step and clearance(tuple(mp)) < .35:
            continue
        if step and any(leg_blocked(tuple(n), tuple(mp)) for n in neighbours if n is not None):
            continue
        return tuple(round(v, 3) for v in mp), round(min(72, fov * 1.42), 1)
    return tuple(p), round(min(72, fov * 1.42), 1)


# ── output ───────────────────────────────────────────────────────────────────
def collection(name):
    coll = bpy.data.collections.get(name)
    if coll:
        for obj in list(coll.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def blender_camera(coll, name, p, t, fov):
    data = bpy.data.cameras.new(name)
    data.sensor_fit = 'VERTICAL'
    data.angle_y = math.radians(fov)
    data.clip_start = .05
    cam = bpy.data.objects.new(name, data)
    cam.location = B(*p)
    direction = B(*t) - B(*p)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    coll.objects.link(cam)


def num(x):
    text = f'{x:.3f}'.rstrip('0').rstrip('.')
    return '0' if text in ('-0', '') else text


def fmt(v):
    return '[' + ', '.join(num(x) for x in v) + ']'


def waypoint(room, label, position, target, fov, points, previous, problems):
    t = points[target] if isinstance(target, str) else Vector(target)
    if previous is not None:
        blocked = leg_blocked(previous, position)
        if blocked:
            problems.append(f'{room} {label} leg → {position} crosses {blocked}')
    c = clearance(position)
    if c < .3:
        problems.append(f'{room} {label} {position} clearance {c:.2f}')
    return f'{{ position: {fmt(position)}, target: {fmt(t)}, fov: {fov} }}'


def main():
    global DG
    DG = bpy.context.evaluated_depsgraph_get()
    coll = collection('CAMERA_SHOTS')
    points = {}
    for name in ANCHORS:
        p = anchor_point(name)
        points[name] = p
        empty = bpy.data.objects.new(f'TARGET_{name}', None)
        empty.empty_display_type = 'SPHERE'
        empty.empty_display_size = .12
        empty.location = B(*p)
        coll.objects.link(empty)

    problems = []
    lines = []
    previous = None
    # Every stop's position, in order, so a shot's mobile framing can check the
    # legs to both of its neighbours.
    sequence = []
    for _room, approach, shots in ROOMS:
        sequence += [w[0] for w in approach]
        for s in shots:
            sequence += [w[0] for w in s['via']] + [s['position']]
    def neighbours(position):
        i = sequence.index(position)
        return (sequence[i - 1] if i else None, sequence[i + 1] if i + 1 < len(sequence) else None)
    shots_total = 0
    for room, approach, shots in ROOMS:
        lines.append(f"  {{\n    room: '{room}',\n    approach: [")
        for position, target, fov in approach:
            lines.append('      ' + waypoint(room, 'approach', position, target, fov, points, previous, problems) + ',')
            previous = position
        lines.append('    ],\n    shots: [')
        for s in shots:
            p, t = s['position'], points[s['subject']]
            spec = ANCHORS[s['subject']]
            prefixes = spec[0] if not isinstance(spec[0], (int, float)) else []
            if previous is not None and not s['via']:
                blocked = leg_blocked(previous, p)
                if blocked:
                    problems.append(f"{room}/{s['shot']} leg crosses {blocked}")
            c = clearance(p)
            if c < .3:
                problems.append(f"{room}/{s['shot']} clearance {c:.2f}")
            blocked = target_blocked(p, tuple(t), prefixes)
            if blocked:
                problems.append(f"{room}/{s['shot']} target {s['subject']} hidden by {blocked}")
            via = []
            for position, target, fov in s['via']:
                via.append(waypoint(room, f"{s['shot']} via", position, target, fov, points, previous, problems))
                previous = position
            if via:
                blocked = leg_blocked(previous, p)
                if blocked:
                    problems.append(f"{room}/{s['shot']} last via leg crosses {blocked}")
            mp, mfov = mobile_framing(p, tuple(t), s['fov'], neighbours(p))
            blender_camera(coll, f"CAM_{room.upper()}_{s['shot'].upper()}", p, tuple(t), s['fov'])
            lines.append(
                f"      {{ shot: '{s['shot']}', subject: '{s['subject']}', position: {fmt(p)}, target: {fmt(t)}, fov: {s['fov']}, hold: {s['hold']},"
                f" mobile: {{ position: {fmt(mp)}, fov: {mfov} }}, via: [{', '.join(via)}], note: '{s['note'].replace(chr(39), '’')}' }},")
            previous = p
            shots_total += 1
        lines.append('    ],\n  },')

    header = (
        '// Generated by blender/scripts/camera_shots.py — edit the compositions there.\n'
        "import type { TourRoom } from './tour'\n\n"
        'export const TOUR_ROOMS: TourRoom[] = [\n'
    )
    with open(OUT_TS, 'w') as f:
        f.write(header + '\n'.join(lines) + '\n]\n')
    for p in problems:
        print('SHOT_PROBLEM', p)
    print(f'SHOTS rooms {len(ROOMS)} shots {shots_total} problems {len(problems)}')
    if os.environ.get('KD_SAVE_BLEND'):
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUTPUT, compress=True)


main()
