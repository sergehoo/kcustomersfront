"""Merges each room's furniture into one object, after camera_shots.py.

Furnishing a room adds dozens of small objects — cushions, books, candles,
pillows, hangers — and every one of them was a draw call in the main pass and
another in the sun's shadow pass, from every camera: the hero view went from
~950 to ~1 880 calls. Static furniture never moves, so each room's pieces are
joined into a single `<Room>_Furniture` object: one glTF mesh whose primitives
are one per material, i.e. one draw call per material per room.

Left apart on purpose:
* linked duplicates (the twin lounge chairs, vases, bowls, plants): glTF
  instancing already draws each set in a single call;
* anything the camera aims at is resolved before this runs — camera_shots.py
  computes its TARGET_ anchors from the separate, named pieces.

Run last in the chain:
    blender -b <pre-restructuring blend> \\
      --python blender/scripts/restructure_front.py \\
      --python blender/scripts/restructure_volumes.py \\
      --python blender/scripts/furnish_interiors.py \\
      --python blender/scripts/refine_details.py \\
      --python blender/scripts/refine_textiles.py \\
      --python blender/scripts/camera_shots.py \\
      --python blender/scripts/merge_furniture.py
"""

import os
from collections import defaultdict
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLEND_OUTPUT = os.path.join(ROOT, 'blender', 'kaydan-villa-production.blend')
GLB_OUTPUT = os.path.join(ROOT, 'assets-source', 'models', 'kaydan-villa-production.glb')

# Rooms of furnish_interiors.py (object-name prefix) and of build_upper_floor.py
# (collection).
PREFIX_ROOMS = {'Living', 'Dining', 'Kitchen', 'Hall', 'Landing', 'Master', 'Bath', 'Bed2', 'Terrace'}
COLLECTION_ROOMS = {'MASTER_SUITE': 'Master', 'DRESSING': 'Master', 'MASTER_BATHROOM': 'Bath', 'SECOND_BEDROOM': 'Bed2'}


def room_of(obj):
    for coll in obj.users_collection:
        if coll.name == 'FURNISHING':
            prefix = obj.name.split('_')[0]
            return prefix if prefix in PREFIX_ROOMS else None
        if coll.name in COLLECTION_ROOMS:
            return COLLECTION_ROOMS[coll.name]
    return None


def select_only(objects, active):
    layer = bpy.context.view_layer
    layer.update()
    for obj in bpy.data.objects:
        if obj.name in layer.objects:
            obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    layer.objects.active = active


def main():
    groups = defaultdict(list)
    kept = 0
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.parent is not None:
            continue
        room = room_of(obj)
        if room is None:
            continue
        if obj.data.users > 1 or obj.modifiers:
            kept += 1
            continue
        groups[room].append(obj)

    before = sum(len(objects) for objects in groups.values())
    for room, objects in sorted(groups.items()):
        if len(objects) < 2:
            continue
        # The largest piece receives the others, so the result keeps a
        # sensible origin inside the room.
        objects.sort(key=lambda o: -max(o.dimensions))
        target = objects[0]
        select_only(objects, target)
        with bpy.context.temp_override(active_object=target, selected_editable_objects=objects, selected_objects=objects):
            bpy.ops.object.join()
        target.name = f'{room}_Furniture'
        target.data.name = target.name
        materials = len({s.material.name for s in target.material_slots if s.material})
        print(f'MERGE {target.name}: {len(objects)} objects → 1 ({materials} materials)')
    select_only([], None)
    print(f'MERGE total {before} objects merged, {kept} instanced/modified kept apart')

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUTPUT, compress=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB_OUTPUT, export_format='GLB', export_cameras=False, export_lights=False,
        export_texcoords=True, export_normals=True, export_tangents=True, export_materials='EXPORT',
        export_yup=True, export_apply=False, export_extras=True,
    )
    print('MERGE_DONE', GLB_OUTPUT)


main()
