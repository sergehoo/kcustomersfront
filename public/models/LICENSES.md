# External 3D model licenses

The models in `public/models/external/` are sourced from Poly Haven and are
distributed under the Creative Commons CC0 1.0 Universal license. They may be
used, modified, and redistributed in commercial projects without attribution.

Poly Haven license: https://polyhaven.com/license

| Local asset | Source asset | Author | License | Source URL |
| --- | --- | --- | --- | --- |
| `external/furniture/modern-arm-chair.glb` | Modern Arm Chair 01 | Vibrant Nordic | CC0 1.0 | https://polyhaven.com/a/modern_arm_chair_01 |
| `external/lighting/modern-ceiling-lamp.glb` | Modern Ceiling Lamp 01 | James Ray Cock | CC0 1.0 | https://polyhaven.com/a/modern_ceiling_lamp_01 |
| `external/vegetation/calathea-orbifolia.glb` | Calathea Orbifolia 01 | Rob Tuytel / Rico Cilliers | CC0 1.0 | https://polyhaven.com/a/calathea_orbifolia_01 |
| `external/vegetation/potted-plant.glb` + alpha map | Potted Plant 01 | Rico Cilliers | CC0 1.0 | https://polyhaven.com/a/potted_plant_01 |

The import pipeline uses the official Poly Haven API and packages each 1K glTF
source plus its PBR textures into a self-contained GLB. Run `npm run import:assets`
to reproduce the import.

## Exterior villa

| Local asset | Source asset | Author | License | Source URL |
| --- | --- | --- | --- | --- |
| `modern_coastal_hillside_villa.glb` | Modern Coastal Hillside Villa | Visthétique | CC BY 4.0 | https://sketchfab.com/3d-models/modern-coastal-hillside-villa-7aa1124e2f0a4013a16f61404deb8259 |
| `exterior/kaydan-coastal-villa-web.glb` | Optimized derivative of the asset above | Visthétique; web optimization by KAYDAN | CC BY 4.0 | https://sketchfab.com/3d-models/modern-coastal-hillside-villa-7aa1124e2f0a4013a16f61404deb8259 |
| `exterior/kaydan-coastal-villa-mobile.glb` | Mobile-optimized derivative of the asset above | Visthétique; web optimization by KAYDAN | CC BY 4.0 | https://sketchfab.com/3d-models/modern-coastal-hillside-villa-7aa1124e2f0a4013a16f61404deb8259 |

The optimized derivative preserves the attribution metadata embedded in the
original GLB. Its textures are resized and converted for WebGL delivery. Run
`npm run optimize:exterior` to regenerate it from the original file.

## Production furniture

| Local asset | Source asset | Author | License | Source URL |
| --- | --- | --- | --- | --- |
| `simple_modern_living_room.glb` | Simple Modern Living Room | dylanheyes | CC BY 4.0 | https://sketchfab.com/3d-models/simple-modern-living-room-e88651f56d78486c8e83dddf1af057c3 |

The Blender production pipeline extracts only the sofa mesh from this scene and
records the attribution in `SOFA_LIVING_CC_BY`. The complete room is not merged
into the KAYDAN architecture.

## Sky and environment

| Local asset | Source asset | Author | License | Source URL |
| --- | --- | --- | --- | --- |
| `../assets/hdr/kloofendal-38d-sunless-1k.hdr` | Kloofendal 38d Partly Cloudy (Pure Sky), 1K HDR with the solar disc clamped out | Greg Zaal / Poly Haven | CC0 1.0 | https://polyhaven.com/a/kloofendal_38d_partly_cloudy_puresky |
| `../assets/hdr/kloofendal-38d-sky-4k.webp`, `-2k.webp` | Same asset, tonemapped JPG resized to 4K / 2K WebP | Greg Zaal / Poly Haven | CC0 1.0 | https://polyhaven.com/a/kloofendal_38d_partly_cloudy_puresky |

Sources are kept in `assets-source/hdr/kloofendal_38d/` (not versioned). Regenerate the served files with `npm run prepare:sky`.
