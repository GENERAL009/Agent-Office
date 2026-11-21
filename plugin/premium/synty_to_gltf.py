# Converts the Synty POLYGON Office FBX source files we use into glTF for the web.
# Run with Blender:
#   Blender -b --factory-startup -P synty_to_gltf.py -- <SourceFiles dir> <out dir> props|chars|textures <name> ...
# textures: the twelve palette atlases, the screens and Net_Alpha, saved next to the models (textures/) as the app expects.
# Props go into one office_props.gltf (one node per prop); each character gets its own file.
# All files share one texture atlas (textures/atlas.jpg).
import bpy, sys, os, json, re

args = sys.argv[sys.argv.index('--') + 1:]
src, out, mode, names = args[0], args[1], args[2], args[3:]
os.makedirs(out, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def materials():
    img = bpy.data.images.load(os.path.join(src, 'Textures', 'PolygonOffice_Texture_01_A.png'))
    img.name = 'atlas'
    atlas = bpy.data.materials.new('Atlas')
    atlas.use_nodes = True
    nt = atlas.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.75

    glass = bpy.data.materials.new('Glass')
    glass.use_nodes = True
    g = glass.node_tree.nodes['Principled BSDF']
    g.inputs['Base Color'].default_value = (0.78, 0.88, 0.97, 1)
    g.inputs['Alpha'].default_value = 0.22
    g.inputs['Roughness'].default_value = 0.05
    try:
        glass.surface_render_method = 'BLENDED'
    except AttributeError:
        glass.blend_method = 'BLEND'

    screen = bpy.data.materials.new('Screen')
    screen.use_nodes = True
    s = screen.node_tree.nodes['Principled BSDF']
    simg = bpy.data.images.load(os.path.join(src, 'Textures', 'PolygonOffice_Texture_Sceen_01.png'))
    simg.name = 'screen'
    stex = screen.node_tree.nodes.new('ShaderNodeTexImage')
    stex.image = simg
    screen.node_tree.links.new(stex.outputs['Color'], s.inputs['Base Color'])
    return atlas, glass, screen


def assign(objs, atlas, glass, screen):
    for o in objs:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            mat = (slot.material.name if slot.material else '').lower()
            name = o.name.lower()
            # Glass panes are their own material (A_Glass) or a child object named *_Glass; a wall piece that is
            # merely *called* Wall_Glass keeps its frame opaque.
            is_glass = 'glass' in mat or (o.parent is not None and re.search(r'_glass(_\d+)?$', name) is not None)
            is_screen = 'screen' in mat or 'sceen' in mat or 'screen' in name or 'sceen' in name
            slot.material = glass if is_glass else screen if is_screen else atlas


def bounds(root):
    """World-space bounding box of a prop, converted to glTF axes (y up)."""
    import mathutils
    lo = mathutils.Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in [root] + list(root.children_recursive):
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            lo = mathutils.Vector(map(min, lo, w))
            hi = mathutils.Vector(map(max, hi, w))
    # Blender (x, y, z) -> glTF (x, z, -y)
    return {'min': [lo.x, lo.z, -hi.y], 'max': [hi.x, hi.z, -lo.y]}


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLTF_SEPARATE', export_texture_dir='textures',
        export_image_format='JPEG', export_jpeg_quality=88, export_yup=True,
        export_apply=False, export_animations=False, export_skins=True,
    )


if mode == 'props':
    reset()
    atlas, glass, screen = materials()
    manifest = {}
    for name in names:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=os.path.join(src, 'FBX', name + '.fbx'))
        new = [o for o in bpy.data.objects if o not in before]
        assign(new, atlas, glass, screen)
        roots = [o for o in new if o.parent is None]
        root = roots[0]
        if len(roots) > 1:
            empty = bpy.data.objects.new(name, None)
            bpy.context.scene.collection.objects.link(empty)
            for r in roots:
                r.parent = empty
            root = empty
        root.name = name
        bpy.context.view_layer.update()
        manifest[name] = bounds(root)
    export(os.path.join(out, 'office_props.gltf'))
    with open(os.path.join(out, 'office_props.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
elif mode == 'textures':
    reset()
    tex_out = os.path.join(out, 'textures')
    os.makedirs(tex_out, exist_ok=True)
    for f in sorted(os.listdir(os.path.join(src, 'Textures'))):
        stem, ext = os.path.splitext(f)
        if ext.lower() not in ('.png', '.tga'):
            continue
        if not (stem.startswith('PolygonOffice_Texture_') or stem == 'Net_Alpha'):
            continue
        img = bpy.data.images.load(os.path.join(src, 'Textures', f))
        img.pixels[0]  # images load lazily; touch the pixels so there is data to save
        alpha = stem == 'Net_Alpha'
        img.filepath_raw = os.path.join(tex_out, stem + ('.png' if alpha else '.jpg'))
        img.file_format = 'PNG' if alpha else 'JPEG'
        img.save()  # raw pixels, no view transform
        names.append(stem)
else:
    for name in names:
        reset()
        atlas, glass, screen = materials()
        bpy.ops.import_scene.fbx(filepath=os.path.join(src, 'Characters', name + '.fbx'))
        assign(list(bpy.data.objects), atlas, glass, screen)
        export(os.path.join(out, name + '.gltf'))
print('DONE', mode, len(names))
