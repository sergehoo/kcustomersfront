"""Build the reproducible KAYDAN Archviz production scene.

Run from customerfront:
  blender -b --factory-startup --python blender/scripts/build_kaydan_production.py
  blender -b blender/kaydan-villa-production.blend --python blender/scripts/render_checkpoints.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_GLB = ROOT / "public/models/exterior/kaydan-coastal-villa-web.glb"
BLEND_OUTPUT = ROOT / "blender/kaydan-villa-production.blend"
GLB_OUTPUT = ROOT / "public/models/production/kaydan-villa-production.glb"
HDRI = ROOT / "public/assets/hdr/blouberg-sunrise-1-1k.hdr"
MATERIAL_ROOT = ROOT / "public/assets/materials-1k"
CC0_ASSETS = ROOT / "public/models/external"
LIVING_ROOM_ASSET = ROOT / "public/models/simple_modern_living_room.glb"

COLLECTION_NAMES = (
    "ARCHITECTURE",
    "EXTERIOR",
    "TERRACE",
    "LIVING_ROOM",
    "BEDROOM",
    "BATHROOM",
    "STAIRS",
    "SECOND_LIVING",
    "CUSTOMER_CARE",
    "FURNITURE",
    "VEGETATION",
    "LIGHTING",
    "DECORATION",
)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.collections, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def build_collections() -> dict[str, bpy.types.Collection]:
    master = bpy.data.collections.new("KAYDAN_PRODUCTION")
    bpy.context.scene.collection.children.link(master)
    collections = {}
    for name in COLLECTION_NAMES:
        collection = bpy.data.collections.new(name)
        master.children.link(collection)
        collections[name] = collection
    return collections


def object_signature(obj: bpy.types.Object) -> str:
    names = [obj.name]
    if obj.type == "MESH":
        names.extend(material.name for material in obj.data.materials if material)
    return " ".join(names).lower()


def classify(obj: bpy.types.Object) -> str:
    name = object_signature(obj)
    if obj.type == "LIGHT" or any(token in name for token in ("light", "lamp", "led", "spot")):
        return "LIGHTING"
    if any(token in name for token in ("dogwood", "oak+tree", "bonsai", "ferns", "trop_leav", "plant", "calathea")):
        return "VEGETATION"
    if any(token in name for token in ("water", "sunbed", "outdoordining", "bbq")):
        return "TERRACE"
    if any(token in name for token in ("rock", "ground", "stone_pathway", "porsche")):
        return "EXTERIOR"
    if "stair" in name:
        return "STAIRS"
    if any(token in name for token in ("faucet2", "sink2", "bathtub", "bath")):
        return "BATHROOM"
    if any(token in name for token in ("faucet1", "diningtable", "diningchair", "diningrug", "couch")):
        return "LIVING_ROOM"
    if any(token in name for token in ("chair", "sofa", "table", "carpet", "rug", "bed")):
        return "FURNITURE"
    if any(token in name for token in ("vase", "frame", "art", "book", "decor")):
        return "DECORATION"
    return "ARCHITECTURE"


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    if obj.name not in collection.objects:
        collection.objects.link(obj)
    for current in list(obj.users_collection):
        if current != collection:
            current.objects.unlink(obj)


def gltf_to_blender(value: tuple[float, float, float]) -> Vector:
    x, y, z = value
    return Vector((x, -z, y))


def normalize_import(imported: list[bpy.types.Object], collections: dict[str, bpy.types.Collection]) -> bpy.types.Object:
    root = bpy.data.objects.new("KAYDAN_VILLA_ROOT", None)
    collections["ARCHITECTURE"].objects.link(root)
    # Same transform as the formerly runtime-applied R3F transform.
    root.location = gltf_to_blender((0.0, -2.162, 18.0))
    root.scale = (0.15, 0.15, 0.15)
    for obj in imported:
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if obj.parent is None:
            obj.parent = root
        move_to_collection(obj, collections[classify(obj)])
    return root


def remove_weak_vegetation(imported: list[bpy.types.Object]) -> list[bpy.types.Object]:
    weak = ("dogwoodtree", "oak+tree", "ferns", "trop_leav", "plants_pdm", "plants.001_pdm")
    kept = []
    for obj in imported:
        if any(token in obj.name.lower() for token in weak):
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            kept.append(obj)
    return kept


def import_cc0_asset(
    path: Path,
    name: str,
    collection: bpy.types.Collection,
    position: tuple[float, float, float],
    target_width: float,
    yaw_degrees: float = 0.0,
    floor_aligned: bool = True,
    include_mesh_tokens: tuple[str, ...] | None = None,
    license_label: str = "CC0 1.0 — Poly Haven",
) -> bpy.types.Object:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path), import_pack_images=True)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    if include_mesh_tokens:
        retained = []
        for obj in list(imported):
            if obj.type == "MESH" and not any(token in obj.name.lower() for token in include_mesh_tokens):
                bpy.data.objects.remove(obj, do_unlink=True)
            else:
                retained.append(obj)
        imported = retained
    imported_set = set(imported)
    tops = [obj for obj in imported if obj.parent not in imported_set]
    root = bpy.data.objects.new(name, None)
    collection.objects.link(root)
    for obj in imported:
        move_to_collection(obj, collection)
    for obj in tops:
        obj.parent = root

    corners = []
    for obj in imported:
        if obj.type == "MESH":
            corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not corners:
        return root
    lower = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    upper = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    center = (lower + upper) * 0.5
    size = upper - lower
    scale = target_width / max(size.x, size.y, 0.001)
    desired = gltf_to_blender(position)
    if floor_aligned:
        desired.z += size.z * scale * 0.5
    root.matrix_world = (
        Matrix.Translation(desired)
        @ Matrix.Rotation(math.radians(yaw_degrees), 4, "Z")
        @ Matrix.Scale(scale, 4)
        @ Matrix.Translation(-center)
    )
    root["kaydan_license"] = license_label
    root["kaydan_source"] = str(path.relative_to(ROOT))
    return root


def add_cc0_assets(collections: dict[str, bpy.types.Collection]) -> None:
    import_cc0_asset(CC0_ASSETS / "vegetation/calathea-orbifolia.glb", "PLANT_LIVING_CC0", collections["VEGETATION"], (-5.45, 3.34, 10.7), 0.78, 18)
    import_cc0_asset(CC0_ASSETS / "vegetation/potted-plant.glb", "PLANT_ENTRANCE_CC0", collections["VEGETATION"], (1.15, 3.34, 12.15), 0.86, -22)
    import_cc0_asset(CC0_ASSETS / "lighting/modern-ceiling-lamp.glb", "PENDANT_LIVING_CC0", collections["LIGHTING"], (-3.8, 6.48, 11.0), 0.48, 0, False)
    import_cc0_asset(CC0_ASSETS / "lighting/modern-ceiling-lamp.glb", "PENDANT_CLIENT_CC0", collections["LIGHTING"], (2.8, 6.35, 8.9), 0.48, 0, False)


def replace_source_couch(collections: dict[str, bpy.types.Collection]) -> None:
    couch = next((obj for obj in bpy.data.objects if "cylinder_couch" in obj.name.lower() and obj.type == "MESH"), None)
    if not couch:
        return
    corners = [couch.matrix_world @ Vector(corner) for corner in couch.bound_box]
    lower = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
    upper = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
    center = (lower + upper) * 0.5
    size = upper - lower
    position = (center.x, lower.z, -center.y)
    width = max(size.x, size.y)
    bpy.data.objects.remove(couch, do_unlink=True)
    import_cc0_asset(
        LIVING_ROOM_ASSET,
        "SOFA_LIVING_CC_BY",
        collections["FURNITURE"],
        position,
        width,
        0,
        True,
        ("sofa",),
        "CC BY 4.0 — dylanheyes / Sketchfab",
    )


def load_image(path: Path, non_color: bool = False) -> bpy.types.Image:
    image = bpy.data.images.load(str(path), check_existing=True)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    return image


def pbr_material(name: str, folder: str, scale: float = 2.0) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    mapping = nodes.new("ShaderNodeMapping")
    texcoord = nodes.new("ShaderNodeTexCoord")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    base = MATERIAL_ROOT / folder
    textures = {}
    for key, filename, non_color in (
        ("base", "basecolor.webp", False),
        ("roughness", "roughness.webp", True),
        ("normal", "normal.webp", True),
    ):
        node = nodes.new("ShaderNodeTexImage")
        node.image = load_image(base / filename, non_color)
        links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        textures[key] = node
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.42
    links.new(textures["base"].outputs["Color"], principled.inputs["Base Color"])
    links.new(textures["roughness"].outputs["Color"], principled.inputs["Roughness"])
    links.new(textures["normal"].outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], principled.inputs["Normal"])
    material["kaydan_pbr_source"] = f"Poly Haven CC0/{folder}"
    return material


def simple_material(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float = 0.0) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return material


def glass_material() -> bpy.types.Material:
    material = simple_material("KAYDAN_GLASS_ARCHITECTURAL", (0.72, 0.86, 0.88, 1.0), 0.08)
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Transmission Weight"].default_value = 0.92
    principled.inputs["IOR"].default_value = 1.48
    material.surface_render_method = "DITHERED"
    material.use_transparency_overlap = False
    return material


def replace_materials() -> None:
    stone = pbr_material("KAYDAN_TRAVERTINE", "marble_01", 2.8)
    plaster = pbr_material("KAYDAN_PLASTER_IVORY", "plastered_wall_04", 2.2)
    wood = pbr_material("KAYDAN_WOOD_WARM", "wood_floor_deck", 1.45)
    textile = pbr_material("KAYDAN_TEXTILE_BOUCLE", "wool_boucle", 3.4)
    glass = glass_material()
    bronze = simple_material("KAYDAN_BRONZE", (0.28, 0.18, 0.095, 1.0), 0.25, 0.82)
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for index, source in enumerate(list(obj.data.materials)):
            if not source:
                continue
            name = source.name.lower()
            target = None
            if any(token in name for token in ("tilestravertine", "concrete048")):
                target = stone
            elif "plaster" in name:
                target = plaster
            elif any(token in name for token in ("wood049", "synthetic_wood")):
                target = wood
            if target:
                obj.data.materials[index] = target


def prepare_lightmap_uv(obj: bpy.types.Object) -> bool:
    if obj.type != "MESH" or len(obj.data.polygons) == 0:
        return False
    mesh = obj.data
    if len(mesh.uv_layers) == 0:
        mesh.uv_layers.new(name="UV0")
    if "LIGHTMAP_UV" not in mesh.uv_layers:
        mesh.uv_layers.new(name="LIGHTMAP_UV")
    mesh.uv_layers.active = mesh.uv_layers["LIGHTMAP_UV"]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.025, area_weight=0.15)
        bpy.ops.object.mode_set(mode="OBJECT")
    except RuntimeError:
        if obj.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        return False
    mesh.uv_layers[0].active_render = True
    obj["kaydan_lightmap_uv"] = "LIGHTMAP_UV"
    obj["kaydan_lightmap_resolution"] = 2048 if len(mesh.polygons) > 2000 else 1024
    return True


def prepare_uvs(collections: dict[str, bpy.types.Collection]) -> int:
    prepared = 0
    static = {"ARCHITECTURE", "EXTERIOR", "TERRACE", "LIVING_ROOM", "BEDROOM", "BATHROOM", "STAIRS", "SECOND_LIVING", "CUSTOMER_CARE"}
    seen = set()
    for name in static:
        for obj in collections[name].objects:
            if obj.type == "MESH" and obj.data not in seen:
                seen.add(obj.data)
                prepared += int(prepare_lightmap_uv(obj))
    return prepared


def add_light(name: str, kind: str, position: tuple[float, float, float], energy: float, color: tuple[float, float, float], collection: bpy.types.Collection, size: float = 4.0) -> None:
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.shape = "DISK"
        data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = gltf_to_blender(position)
    collection.objects.link(obj)


def configure_lighting(collections: dict[str, bpy.types.Collection]) -> None:
    world = bpy.data.worlds.new("KAYDAN_DAYLIGHT") if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    background = nodes.new("ShaderNodeBackground")
    background.inputs["Strength"].default_value = 0.42
    environment = nodes.new("ShaderNodeTexEnvironment")
    environment.image = load_image(HDRI)
    links.new(environment.outputs["Color"], background.inputs["Color"])
    links.new(background.outputs["Background"], output.inputs["Surface"])

    sun_data = bpy.data.lights.new("KAYDAN_SUN", "SUN")
    sun_data.energy = 2.1
    sun_data.angle = math.radians(8.0)
    sun_data.color = (1.0, 0.78, 0.58)
    sun = bpy.data.objects.new("KAYDAN_SUN", sun_data)
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-132))
    collections["LIGHTING"].objects.link(sun)
    add_light("LIVING_BOUNCE", "AREA", (-1.2, 6.7, 10.4), 620.0, (1.0, 0.76, 0.55), collections["LIGHTING"], 3.8)
    add_light("CORRIDOR_BOUNCE", "AREA", (3.7, 6.4, 7.1), 420.0, (1.0, 0.72, 0.48), collections["LIGHTING"], 2.8)
    add_light("TERRACE_WARMTH", "AREA", (-1.0, 6.1, 2.8), 520.0, (1.0, 0.66, 0.38), collections["LIGHTING"], 4.2)


CAMERAS = {
    "EXTERIOR": ((4.8, 1.65, 31.5), (2.3, 4.75, 13.6)),
    "ENTRANCE": ((0.967006, 1.821527, 24.169864), (2.255267, 4.793477, 13.516817)),
    "LIVING": ((0.890636, 4.286496, 16.346899), (2.153930, 4.776479, 12.410542)),
    "BEDROOM": ((-3.516048, 4.84, 12.170929), (-6.274010, 4.399800, 10.360260)),
    "BATHROOM": ((-2.207797, 4.840174, 9.318309), (-0.740971, 4.418164, 9.574418)),
    "SECOND_LIVING": ((3.393872, 4.631847, 5.528773), (4.906324, 3.832000, 3.115704)),
    "TERRACE": ((-2.5, 4.6, 3.25), (-3.6, 4.2, 6.2)),
}


def create_camera(name: str, position: tuple[float, float, float], target: tuple[float, float, float], collection: bpy.types.Collection) -> bpy.types.Object:
    data = bpy.data.cameras.new(f"CAM_{name}")
    data.lens = 38.6
    data.sensor_width = 36.0
    data.dof.use_dof = False
    camera = bpy.data.objects.new(f"CAM_{name}", data)
    camera.location = gltf_to_blender(position)
    direction = gltf_to_blender(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera["kaydan_checkpoint"] = name
    collection.objects.link(camera)
    return camera


def configure_cameras(collections: dict[str, bpy.types.Collection]) -> None:
    for name, (position, target) in CAMERAS.items():
        create_camera(name, position, target, collections["CUSTOMER_CARE"])
    bpy.context.scene.camera = bpy.data.objects["CAM_EXTERIOR"]


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 4
    scene.cycles.transmission_bounces = 6
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.image_settings.color_mode = "RGBA"
    scene["kaydan_reference_engine"] = "Cycles"


def export_glb() -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_OUTPUT),
        export_format="GLB",
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_yup=True,
        export_apply=False,
        export_extras=True,
    )


def main() -> None:
    reset_scene()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    collections = build_collections()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB), import_pack_images=True)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    imported = remove_weak_vegetation(imported)
    normalize_import(imported, collections)
    replace_source_couch(collections)
    replace_materials()
    add_cc0_assets(collections)
    prepared = prepare_uvs(collections)
    configure_lighting(collections)
    configure_cameras(collections)
    configure_render()
    scene["kaydan_source_glb"] = str(SOURCE_GLB.relative_to(ROOT))
    scene["kaydan_uv2_meshes"] = prepared
    scene["kaydan_license"] = "Villa: CC BY 4.0 Visthétique; added PBR maps: Poly Haven CC0"
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_OUTPUT), compress=True)
    export_glb()
    print(f"KAYDAN_PRODUCTION blend={BLEND_OUTPUT} glb={GLB_OUTPUT} uv2={prepared} objects={len(bpy.data.objects)}")


if __name__ == "__main__":
    main()
