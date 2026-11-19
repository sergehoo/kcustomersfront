"""Render the seven Blender look-dev checkpoints from the production blend."""

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "blender/renders"
CHECKPOINTS = ("EXTERIOR", "ENTRANCE", "LIVING", "BEDROOM", "BATHROOM", "SECOND_LIVING", "TERRACE")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    # Cycles is the reference renderer; conservative samples keep this repeatable on laptops.
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    for name in CHECKPOINTS:
        camera = bpy.data.objects.get(f"CAM_{name}")
        if not camera:
            continue
        scene.camera = camera
        scene.render.filepath = str(OUTPUT / f"{name.lower()}.png")
        bpy.ops.render.render(write_still=True)
        print(f"KAYDAN_RENDER {name} -> {scene.render.filepath}")


if __name__ == "__main__":
    main()
