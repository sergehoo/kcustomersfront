"""Hangs a television in the living room, after refine_textiles.py.

The living room has a screen: a slim 65-inch panel on the chimney breast,
facing the sofa, where the canvas hung. The canvas goes; nothing else moves.
At runtime it plays Kaydan's presentation film (src/experience/Television.tsx),
whose sound the visit's audio engine places in the room.

* `Living_TV` — the panel: a 38 mm black body with a 9 mm bezel.
* `Living_TV_Screen` — the picture, material `KAYDAN_TV_SCREEN`. The image
  drawn here (a generic studio, no channel's branding) is only what the model
  shows on its own, in Blender or if the film cannot load: the runtime
  replaces it with the film and keeps the screen lit by day and by night.

The living-room shots are aimed at fixed anchors (camera_shots.py), so no
framing depends on the canvas that is removed.

Run after refine_textiles.py, in the same Blender session, before
camera_shots.py:
    blender -b blender/backup-avant-restructuration-2026-11-19/kaydan-villa-production.blend \\
      --python blender/scripts/restructure_front.py \\
      --python blender/scripts/restructure_volumes.py \\
      --python blender/scripts/furnish_interiors.py \\
      --python blender/scripts/refine_details.py \\
      --python blender/scripts/refine_textiles.py \\
      --python blender/scripts/refine_media.py \\
      --python blender/scripts/camera_shots.py \\
      --python blender/scripts/merge_furniture.py

Coordinates are glTF (x, y up, z towards the road): Blender (x, -z, y).
"""

import bmesh
import bpy
import numpy as np
from mathutils import Vector

WIDTH, HEIGHT, DEPTH, BEZEL = 1.46, .84, .038, .009

REPORT = []


def studio_image(name='KAYDAN_TV_NEWS', width=768, height=432):
    """A generic news studio, out of focus: enough to read as a programme."""
    image = bpy.data.images.get(name)
    if image:
        return image
    rng = np.random.default_rng(5)
    y, x = np.mgrid[0:height, 0:width]
    u, v = x / width, 1 - y / height
    # Deep blue set, lighter towards a video wall behind the desk.
    glow = np.exp(-(((u - .62) / .42) ** 2 + ((v - .62) / .38) ** 2))
    rgb = np.stack([.02 + .10 * glow, .05 + .22 * glow, .14 + .46 * glow], -1)
    # Panels of the video wall: soft vertical bands of slightly different blues.
    for k in range(7):
        centre, half = .2 + k * .11, .04
        band = np.clip(1 - np.abs(u - centre) / half, 0, 1) * np.clip((v - .42) / .1, 0, 1) * np.clip((.95 - v) / .1, 0, 1)
        tint = np.array([.05, .12 + .05 * rng.random(), .22 + .12 * rng.random()])
        rgb += band[..., None] * tint * .55
    # The presenter: a head and shoulders as two warm shapes, left of centre.
    head = np.exp(-(((u - .34) / .045) ** 2 + ((v - .66) / .075) ** 2) * 1.6)
    body = np.exp(-(((u - .34) / .12) ** 2 + ((v - .44) / .13) ** 2) * 1.4)
    rgb += head[..., None] * np.array([.62, .46, .36]) + body[..., None] * np.array([.10, .12, .17])
    # Desk: a pale bar across the lower middle.
    desk = np.clip(1 - np.abs(v - .30) / .035, 0, 1) * np.clip((u - .12) / .06, 0, 1) * np.clip((.86 - u) / .06, 0, 1)
    rgb += desk[..., None] * np.array([.55, .6, .68]) * .7
    # Lower third and ticker: plain bars, no lettering.
    title = ((v > .135) & (v < .215) & (u > .07) & (u < .62))[..., None]
    rgb = np.where(title, np.array([.86, .88, .9]), rgb)
    accent = ((v > .135) & (v < .215) & (u > .07) & (u < .085))[..., None]
    rgb = np.where(accent, np.array([.85, .32, .12]), rgb)
    ticker = ((v > .05) & (v < .105))[..., None]
    rgb = np.where(ticker, np.array([.05, .09, .2]), rgb)
    # A few "words" on both strips, as darker and lighter dashes.
    for strip, (v0, v1, colour) in enumerate(((.160, .190, (.12, .15, .22)), (.068, .088, (.72, .76, .84)))):
        cursor = .1 if strip == 0 else .03
        limit = .58 if strip == 0 else .97
        while cursor < limit:
            length = .02 + rng.random() * .05
            dash = ((v > v0) & (v < v1) & (u > cursor) & (u < min(limit, cursor + length)))[..., None]
            rgb = np.where(dash, np.array(colour), rgb)
            cursor += length + .012
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((height, width, 1))], -1).astype(np.float32)
    image = bpy.data.images.new(name, width, height, alpha=False)
    image.pixels.foreach_set(np.flipud(rgba).ravel())
    image.pack()
    return image


def materials():
    body = bpy.data.materials.get('KAYDAN_TV_BODY')
    if body is None:
        body = bpy.data.materials.new('KAYDAN_TV_BODY')
        body.use_nodes = True
        bsdf = body.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (.012, .012, .014, 1)
        bsdf.inputs['Roughness'].default_value = .32
        bsdf.inputs['Metallic'].default_value = .2
    screen = bpy.data.materials.get('KAYDAN_TV_SCREEN')
    if screen is None:
        screen = bpy.data.materials.new('KAYDAN_TV_SCREEN')
        screen.use_nodes = True
        nodes, links = screen.node_tree.nodes, screen.node_tree.links
        bsdf = nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (.01, .01, .012, 1)
        bsdf.inputs['Roughness'].default_value = .12
        picture = nodes.new('ShaderNodeTexImage')
        picture.image = studio_image()
        links.new(picture.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = 1.0
    return body, screen


def mesh_object(name, bm, material):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.data.collections['FURNISHING'].objects.link(obj)
    return obj


def television():
    art = bpy.data.objects.get('Living_Art')
    if art is None:
        REPORT.append('Living_Art not found: no television hung')
        return
    bpy.context.view_layer.update()
    corners = [art.matrix_world @ Vector(corner) for corner in art.bound_box]
    # The canvas is thin along x and faces -x (the sofa): its far side is the wall.
    wall = max(c.x for c in corners)
    centre_y = (min(c.y for c in corners) + max(c.y for c in corners)) / 2
    centre_z = (min(c.z for c in corners) + max(c.z for c in corners)) / 2
    bpy.data.objects.remove(art, do_unlink=True)
    body, screen = materials()

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for vert in bm.verts:
        vert.co = Vector((wall - DEPTH / 2 + vert.co.x * DEPTH, centre_y + vert.co.y * WIDTH, centre_z + vert.co.z * HEIGHT))
    mesh_object('Living_TV', bm, body)

    # The picture, 1.5 mm proud of the body, seen from the room (looking +x):
    # the viewer's right is Blender -y.
    x = wall - DEPTH - .0015
    half_w, half_h = WIDTH / 2 - BEZEL, HEIGHT / 2 - BEZEL
    bm = bmesh.new()
    quad = [
        (bm.verts.new((x, centre_y + half_w, centre_z - half_h)), (0, 0)),
        (bm.verts.new((x, centre_y - half_w, centre_z - half_h)), (1, 0)),
        (bm.verts.new((x, centre_y - half_w, centre_z + half_h)), (1, 1)),
        (bm.verts.new((x, centre_y + half_w, centre_z + half_h)), (0, 1)),
    ]
    face = bm.faces.new([vert for vert, _uv in quad])
    bm.normal_update()
    if face.normal.x > 0:
        face.normal_flip()
    layer = bm.loops.layers.uv.new('UVMap')
    uv_of = {vert: uv for vert, uv in quad}
    for loop in face.loops:
        loop[layer].uv = uv_of[loop.vert]
    mesh_object('Living_TV_Screen', bm, screen)
    # glTF: x, y up = Blender z, z = -Blender y.
    REPORT.append(f'television on the chimney breast: centre glTF ({x:.3f}, {centre_z:.3f}, {-centre_y:.3f}), {WIDTH} x {HEIGHT} m')


def main():
    television()
    for line in REPORT:
        print('MEDIA', line)
    print('MEDIA_DONE')


main()
