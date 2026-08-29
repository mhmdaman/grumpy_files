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

# Save while preserving transparency
frames[0].save(
    output_file,
    save_all=True,
    append_images=frames[1:],
    duration=120,
    loop=0,
    disposal=2
)

print(f"🐥 GIF created successfully: {output_file}")