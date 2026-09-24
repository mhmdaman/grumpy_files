from PIL import Image
import sys

input_file = sys.argv[1]
output_file = sys.argv[2]

sprite = Image.open(input_file).convert("RGBA")

frames_count = 8

frame_width = sprite.width // frames_count
frame_height = sprite.height

frames = []

for i in range(frames_count):
    left = i * frame_width

    frame = sprite.crop(
        (left, 0, left + frame_width, frame_height)
    ).convert("RGBA")

    frames.append(frame)

# Convert RGBA frames to P mode with palette and alpha transparency preserved
p_frames = []
for f in frames:
    alpha = f.split()[3]
    rgb = f.convert("RGB")
    p_frame = rgb.convert("P", palette=Image.ADAPTIVE, colors=255)
    mask = Image.eval(alpha, lambda a: 255 if a < 128 else 0)
    p_frame.paste(255, mask)
    p_frame.info["transparency"] = 255
    p_frame.info["duration"] = 120
    p_frame.info["disposal"] = 2
    p_frames.append(p_frame)

# Save with full multi-frame transparency
p_frames[0].save(
    output_file,
    save_all=True,
    append_images=p_frames[1:],
    duration=120,
    loop=0,
    transparency=255,
    disposal=2
)

print(f"🐥 GIF created successfully: {output_file}")