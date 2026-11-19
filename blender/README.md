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
