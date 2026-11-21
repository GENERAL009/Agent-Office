# Retargets Mixamo animations (FBX, "Without Skin", Y Bot) onto the Synty POLYGON Office skeleton
# and writes them into one glTF the app plays on every Synty character.
# Run with Blender:
#   Blender -b --factory-startup -P tools/mixamo_to_synty.py -- <Synty character .fbx> <out .gltf> <anim.fbx> ...
# Both rigs rest in a T-pose, so each target bone gets the source bone's rotation *relative to its rest*,
# expressed in world space. Hips also get the source's vertical/horizontal offset, scaled by leg length.
import bpy, sys, os
from mathutils import Matrix

args = sys.argv[sys.argv.index('--') + 1:]
target_fbx, out_path, anim_files = args[0], args[1], args[2:]

BASE = {
    'Hips': 'Pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02', 'Spine2': 'spine_03', 'Neck': 'neck_01', 'Head': 'head',
}
for side, s in (('Left', 'l'), ('Right', 'r')):
    S = s.upper()
    BASE.update({
        f'{side}Shoulder': f'clavicle_{s}', f'{side}Arm': f'UpperArm_{S}', f'{side}ForeArm': f'lowerarm_{s}', f'{side}Hand': f'Hand_{S}',
        f'{side}UpLeg': f'Thigh_{S}', f'{side}Leg': f'calf_{s}', f'{side}Foot': f'Foot_{S}', f'{side}ToeBase': f'ball_{s}',
        f'{side}HandThumb1': f'thumb_01_{s}', f'{side}HandThumb2': f'thumb_02_{s}', f'{side}HandThumb3': f'thumb_03_{s}',
        f'{side}HandIndex1': f'indexFinger_01_{s}', f'{side}HandIndex2': f'indexFinger_02_{s}', f'{side}HandIndex3': f'indexFinger_03_{s}',
        f'{side}HandMiddle1': f'finger_01_{s}', f'{side}HandMiddle2': f'finger_02_{s}', f'{side}HandMiddle3': f'finger_03_{s}',
    })


def strip(name):
    return name.split(':')[-1]


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=target_fbx)
tgt = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
tgt.animation_data_create()
scene = bpy.context.scene

# Target bones in parent-first order.
order = []
def walk(b):
    order.append(b.name)
    for c in b.children:
        walk(c)
for b in tgt.data.bones:
    if b.parent is None:
        walk(b)

def world_rest(arm, bone):
    return arm.matrix_world @ bone.matrix_local

def leg_length(arm, hips, foot):
    return (world_rest(arm, arm.data.bones[hips]).to_translation() - world_rest(arm, arm.data.bones[foot]).to_translation()).length

made = []
for path in anim_files:
    clip = os.path.splitext(os.path.basename(path))[0].replace(' ', '_')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    src = next(o for o in new if o.type == 'ARMATURE')
    act = src.animation_data.action
    f0, f1 = (int(v) for v in act.frame_range)

    smap = {}  # target bone -> source bone name
    for sb in src.data.bones:
        t = BASE.get(strip(sb.name))
        if t and t in tgt.data.bones:
            smap[t] = sb.name
    s_hips = next(n for n in src.data.bones.keys() if strip(n) == 'Hips')
    s_foot = next(n for n in src.data.bones.keys() if strip(n) == 'LeftFoot')
    scale = leg_length(tgt, 'Pelvis', 'Foot_L') / leg_length(src, s_hips, s_foot)

    action = bpy.data.actions.new(clip)
    tgt.animation_data.action = action
    for pb in tgt.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        for name in order:
            if name not in smap:
                continue
            tb = tgt.pose.bones[name]
            sb = src.pose.bones[smap[name]]
            s_pose = src.matrix_world @ sb.matrix
            s_rest = world_rest(src, sb.bone)
            t_rest = world_rest(tgt, tb.bone)
            delta = s_pose.to_quaternion() @ s_rest.to_quaternion().inverted()
            rot = (delta @ t_rest.to_quaternion()).to_matrix().to_4x4()
            if name == 'Pelvis':
                offset = (s_pose.to_translation() - s_rest.to_translation()) * scale
                head = t_rest.to_translation() + offset
            else:
                head = (tgt.matrix_world @ tb.matrix).to_translation()
            tb.matrix = tgt.matrix_world.inverted() @ (Matrix.Translation(head) @ rot)
            tb.keyframe_insert('rotation_quaternion', frame=f - f0)
            if name == 'Pelvis':
                tb.keyframe_insert('location', frame=f - f0)
            bpy.context.view_layer.update()  # children need this bone's new pose

    track = tgt.animation_data.nla_tracks.new()
    track.name = clip
    track.strips.new(clip, 0, action)
    tgt.animation_data.action = None
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for pb in tgt.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    made.append(f'{clip}({f1 - f0 + 1}f)')

bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_skins=True, export_yup=True,
                          export_image_format='NONE')
print('DONE', ' '.join(made))
