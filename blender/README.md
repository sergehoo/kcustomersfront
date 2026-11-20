# KAYDAN villa production

Blender is the source of truth for the production villa. The React application remains responsible for interaction, scroll and UI only.

## Build

```bash
blender -b --factory-startup --python blender/scripts/build_kaydan_production.py
```

This command imports the current detailed villa, applies the same real-world transform as R3F, creates the requested collections, replaces priority surfaces with documented CC0 PBR materials, creates a second non-overlapping UV channel, configures architectural lighting and reference cameras, then writes:

- `blender/kaydan-villa-production.blend`
- `public/models/production/kaydan-villa-production.glb`

Then create the web delivery variants with:

```bash
npm run optimize:production
```

## Reference renders

```bash
blender -b blender/kaydan-villa-production.blend --python blender/scripts/render_checkpoints.py
```

The renders are written to `blender/renders/`. Cycles with conservative samples and denoising is used for the reference checkpoints. Increase the sample count for final lightmap and marketing-grade renders after asset replacement.

## Lightmaps

Static meshes have a `LIGHTMAP_UV` second channel and lightmap resolution metadata. Blender's standard glTF exporter preserves the UV channel but does not encode Three.js `lightMap` assignment. Final baked images must be exported separately and connected through a generated node/lightmap manifest; baking an unvalidated low-detail asset would only freeze its current defects.

Bake the six camera-priority architectural surfaces (ground, stone wall,
plaster, concrete, path and travertine) with Cycles direct + indirect
irradiance. The selection is explicit so high-poly props never displace the
architecture:

```bash
blender -b blender/kaydan-villa-production.blend --python blender/scripts/bake_lightmaps.py
```

The command writes the maps and `public/assets/lightmaps/manifest.json`, plus a non-destructive `blender/kaydan-villa-baked.blend`. The runtime should only enable a map after its object-level bake has been visually approved.

## Front restructuring

The front (access, stair, landing, entrance, tiers, parvis, driveway, fence and
gates) is rebuilt as one composition on the porch axis (x 4.225) by:

```bash
blender -b blender/kaydan-villa-production.blend --python blender/scripts/restructure_front.py
npm run optimize:production
```

It deletes every earlier approach geometrically (named objects and the
purchased model's own front steps, banks and stone edges, face by face), then
rebuilds with metric UVs and writes both the `.blend` and
`assets-source/models/kaydan-villa-production.glb`. Run it on a blend that has
not been restructured yet (the pre-restructuring copy is kept in
`blender/backup-avant-restructuration-2026-11-19/`).

## Large volumes

`restructure_volumes.py` runs after the front script, in the same Blender
session, so the whole villa is always rebuilt from the pre-restructuring blend:

```bash
blender -b blender/backup-avant-restructuration-2026-11-19/kaydan-villa-production.blend \
  --python blender/scripts/restructure_front.py \
  --python blender/scripts/restructure_volumes.py
npm run optimize:production
```

It replaces the 0.8 m slab-and-upstand over the porch with a deep white frame
around the upper volume (lintel, jambs, 22 cm balcony slab, frameless glass
balcony on an anthracite shoe), restyles every railing to clear glass with an
anthracite profile, opens the east wall (glazing, oak screen, upper bay) and
gives the carport a bronze slatted door, a lit lintel and a paved floor.

It also holds the upper floor's permanent geometry that the browser used to
patch at load time: the purchased model's partitions, door, downstand and sill
inside the master bathroom are deleted, the suite and bathroom get real
doorways, and the bathroom its ceiling. Furniture stays modular.

The east bank is cut with straight `bisect` planes before any face is
deleted (the terrain's triangles are ~1.7 m), then held by a low wall, a
planted shelf and an upper wall, with the natural bank behind.

## Furnishing and camera shots

The full chain, always from the pre-restructuring blend:

```bash
python3 blender/scripts/generate_art.py          # abstract canvases → assets-source/art/
blender -b blender/backup-avant-restructuration-2026-11-19/kaydan-villa-production.blend \
  --python blender/scripts/restructure_front.py \
  --python blender/scripts/restructure_volumes.py \
  --python blender/scripts/furnish_interiors.py \
  --python blender/scripts/refine_details.py \
  --python blender/scripts/camera_shots.py \
  --python blender/scripts/merge_furniture.py
npm run optimize:production
```

`furnish_interiors.py` dresses every room — living, dining, kitchen, hall,
landing, suite, bathroom, second bedroom, terrace — with CC0 Poly Haven pieces
(`assets-source/models/external/polyhaven/`, see `public/models/LICENSES.md`)
and pieces built in place (sofas, cushions, curtains, canvases, books, stools,
lamps). It also applies the upper floor's bevel/subdivision modifiers, which the
glTF export ignores, slides one leaf of the south bay open, and gives the
camera's subjects readable names (`Kitchen_Island_*`, `Dining_Table_*`…).

`refine_details.py` rebuilds the pieces seen closest: the freestanding tub and
its floor-standing filler, the shower's wet wall and fittings (mixer, rain
head, hand shower, niche, linear drain), and both beds' soft goods — duvet,
turned-down band and runner draped by a cloth simulation, shaped pillows, a
linen weave. The shots aimed at those pieces have pinned targets
(`PINNED` in `camera_shots.py`), so remodelling them never moves a framing.

`camera_shots.py` holds the visit's compositions: per room an overview and
focus shots, each aimed at a `TARGET_*` anchor on real furniture, and the
waypoints between them through real passages. It validates them against the
model (camera clearance, target visible, no leg through a wall), derives a
mobile framing per shot, adds a `CAM_<ROOM>_<SHOT>` camera per shot to the
`CAMERA_SHOTS` collection for tuning, and writes `src/experience/tourShots.ts`.
Re-run it alone after moving a shot:

```bash
blender -b blender/kaydan-villa-production.blend --python blender/scripts/camera_shots.py
```

`merge_furniture.py` runs last: each room's static furniture is joined into one
`<Room>_Furniture` object (one draw call per material per room) once the shots
have taken their targets from the separate pieces. Linked duplicates stay apart,
since glTF instancing already draws each set in one call. Re-running
`camera_shots.py` alone needs the unmerged blend, so re-run the whole chain.
