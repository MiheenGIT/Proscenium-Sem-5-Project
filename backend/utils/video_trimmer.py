"""
Trim a video file using ffmpeg.

Usage:
    python trim_video.py

Edit the CONFIG section below, or run with command-line args:
    python trim_video.py "movie.mp4" 00:05:00 00:35:00
"""

import os
import sys
import subprocess

# ============================================================
# CONFIG — edit these if not passing command-line args
# ============================================================

DOWNLOADS_PATH = os.path.join(os.path.expanduser("~"), "Downloads")

INPUT_FILENAME = "movie.mp4"     # file inside Downloads
START_TIME = "00:00:00"          # HH:MM:SS
END_TIME = "01:00:00"            # HH:MM:SS

LOSSLESS = True  # True = fast but may snap to nearest keyframe
                  # False = frame-accurate but re-encodes (slower)


def trim(input_path: str, start: str, end: str, output_path: str, lossless: bool = True) -> None:
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    cmd = [
        "ffmpeg",
        "-y",
        "-ss", start,
        "-to", end,
        "-i", input_path,
    ]

    if lossless:
        cmd += ["-c", "copy"]
    else:
        cmd += ["-c:v", "libx264", "-c:a", "aac"]

    cmd.append(output_path)

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{result.stderr}")

    print(f"Done. Saved to: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) >= 4:
        filename = sys.argv[1]
        start = sys.argv[2]
        end = sys.argv[3]
    else:
        filename = INPUT_FILENAME
        start = START_TIME
        end = END_TIME

    input_path = os.path.join(DOWNLOADS_PATH, filename)

    name, ext = os.path.splitext(filename)
    output_path = os.path.join(DOWNLOADS_PATH, f"{name}_trimmed{ext}")

    trim(input_path, start, end, output_path, lossless=LOSSLESS)