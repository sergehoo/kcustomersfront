"""Bake Cycles irradiance maps for the most important architectural surfaces.

Run from customerfront after building the production blend:
  blender -b blender/kaydan-villa-production.blend --python blender/scripts/bake_lightmaps.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public/assets/lightmaps"
BAKED_BLEND = ROOT / "blender/kaydan-villa-baked.blend"
COLLECTIONS = ("ARCHITECTURE", "EXTERIOR", "TERRACE", "LIVING_ROOM", "STAIRS")

# Polygon count is a poor proxy for Archviz importance: the first version picked
# the car, faucet and dining chairs. Keep this explicit list aligned with the
# surfaces actually crossed by the production camera rail.
PRIORITY_SURFACES = (
    "Plane.003_Ground003_0",
    "Plane_rock_wall_11_disp_2k_0",
    "Plane_Plaster_0",
    "Plane_Concrete048_0",
    "Plane.006_stone_pathway_02_0",
    "Plane_TilesTravertine_0",
)


def safe_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def candidates() -> list[bpy.types.Object]:
    allowed = {
        obj.name: obj
        for collection_name in COLLECTIONS
        if (collection := bpy.data.collections.get(collection_name))
        for obj in collection.objects
        if obj.type == "MESH" and "LIGHTMAP_UV" in obj.data.uv_layers
    }
    missing = [name for name in PRIORITY_SURFACES if name not in allowed]
    if missing:
        raise RuntimeError(f"Missing priority lightmap surfaces: {missing}")
    return [allowed[name] for name in PRIORITY_SURFACES]


def active_image_nodes(obj: bpy.types.Object, image: bpy.types.Image) -> list[tuple[bpy.types.Material, bpy.types.Node]]:
    created = []
    for material in obj.data.materials:
        if not material:
            continue
        material.use_nodes = True
        node = material.node_tree.nodes.new("ShaderNodeTexImage")
        node.name = f"KAYDAN_LIGHTMAP_{safe_name(obj.name)}"
        node.label = "KAYDAN baked irradiance — UV2"
        node.image = image
        material.node_tree.nodes.active = node
        created.append((material, node))
    return created


def bake_object(obj: bpy.types.Object) -> dict[str, object]:
    resolution = 1024
    filename = f"{safe_name(obj.name)}-{resolution}.png"
    image = bpy.data.images.new(f"LM_{obj.name}", width=resolution, height=resolution, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color"
    image.file_format = "PNG"
    image.filepath_raw = str(OUTPUT / filename)
    nodes = active_image_nodes(obj, image)
    obj.data.uv_layers.active = obj.data.uv_layers["LIGHTMAP_UV"]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="DIFFUSE", margin=12, use_clear=True)
    image.save()
    return {
        "node": obj.name,
        "url": f"/assets/lightmaps/{filename}",
        "uv": 1,
        "resolution": resolution,
        "polygons": len(obj.data.polygons),
        "materials": [material.name for material, _ in nodes],
    }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    # This directory is generated exclusively by this script. Remove bakes from
    # an older selection so the manifest and delivered files cannot diverge.
    for existing in OUTPUT.glob("*.png"):
        existing.unlink()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    manifest = [bake_object(obj) for obj in candidates()]
    (OUTPUT / "manifest.json").write_text(json.dumps({"version": 1, "maps": manifest}, indent=2), encoding="utf-8")
    scene["kaydan_lightmap_manifest"] = "public/assets/lightmaps/manifest.json"
    bpy.ops.wm.save_as_mainfile(filepath=str(BAKED_BLEND), compress=True)
    print(f"KAYDAN_LIGHTMAPS count={len(manifest)} manifest={OUTPUT / 'manifest.json'} blend={BAKED_BLEND}")


if __name__ == "__main__":
    main()
