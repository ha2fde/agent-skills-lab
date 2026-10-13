import argparse
import torch
from diffusers import QwenImage21Pipeline

p = argparse.ArgumentParser()
p.add_argument("--prompt", required=True)
p.add_argument("--out", default="/workspace/output/result.png")
p.add_argument("--width", type=int, default=1024)
p.add_argument("--height", type=int, default=1024)
p.add_argument("--steps", type=int, default=40)
a = p.parse_args()

pipe = QwenImage21Pipeline.from_pretrained(
    "Qwen/Qwen-Image-2.1",
    torch_dtype=torch.bfloat16,
).to("cuda")

image = pipe(
    prompt=a.prompt,
    width=a.width,
    height=a.height,
    num_inference_steps=a.steps,
    generator=torch.Generator("cuda").manual_seed(42),
).images[0]

image.save(a.out)
print(a.out)
