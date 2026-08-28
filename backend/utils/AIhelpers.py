import os
import cv2
import numpy as np
import openvino as ov
import subprocess
import shutil


# ---------------------------------------------------------
# OpenVINO configuration
# ---------------------------------------------------------

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_PATH = os.getenv(
    "OPENVINO_SR_MODEL",
    str(PROJECT_ROOT / "models" / "single-image-super-resolution-1032.xml")
)

DEVICE = os.getenv("OPENVINO_DEVICE", "GPU")


# ---------------------------------------------------------
# Load model once when backend starts
# ---------------------------------------------------------

print("[AI] Loading OpenVINO super-resolution model...")

_core = ov.Core()

print(f"[AI] Available devices: {_core.available_devices}")

_model = _core.read_model(MODEL_PATH)
_compiled_model = _core.compile_model(_model, DEVICE)

# single-image-super-resolution-1032 requires TWO inputs, not one:
#   input "0" -> the image at the model's native low-res size (270x480), BGR
#   input "1" -> the SAME image bicubic-upsampled to the output size (1920x1080), BGR
# Feeding only one input (the old code) is a spec violation, not just suboptimal.
# Color order is BGR for both inputs and the output - do NOT convert to RGB.
_input_low_res = _compiled_model.input(0)
_input_bicubic = _compiled_model.input(1)
_output_layer = _compiled_model.output(0)

print(f"[AI] Model loaded on {DEVICE}.")
print(f"[AI] Low-res input shape: {_input_low_res.shape}")
print(f"[AI] Bicubic input shape: {_input_bicubic.shape}")
print(f"[AI] Output shape: {_output_layer.shape}")


# ---------------------------------------------------------
# Upscale one frame
# ---------------------------------------------------------

def _compute_letterbox(src_w: int, src_h: int, dst_w: int, dst_h: int):
    """
    Returns (new_w, new_h, pad_x, pad_y): the size to resize a
    src_w x src_h image into (preserving its aspect ratio) plus the
    padding needed to center it inside a dst_w x dst_h canvas.

    Used so non-16:9 sources get letterboxed instead of stretched,
    since the model's inputs/output are fixed at 16:9.
    """
    scale = min(dst_w / src_w, dst_h / src_h)
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))
    pad_x = (dst_w - new_w) // 2
    pad_y = (dst_h - new_h) // 2
    return new_w, new_h, pad_x, pad_y


def _letterbox_resize(frame: np.ndarray, dst_w: int, dst_h: int) -> np.ndarray:
    src_h, src_w = frame.shape[:2]
    new_w, new_h, pad_x, pad_y = _compute_letterbox(src_w, src_h, dst_w, dst_h)
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    canvas = np.zeros((dst_h, dst_w, 3), dtype=frame.dtype)
    canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized
    return canvas


def _upscale_frame(frame: np.ndarray) -> np.ndarray:
    """
    Takes a raw BGR frame (any source resolution/aspect ratio) and
    returns the model's raw BGR output at the model's fixed output
    size (e.g. 1920x1080), letterboxed to preserve the source's
    aspect ratio. Callers must crop out the padding themselves -
    see the letterbox geometry computed once in ai_upscale_video().

    IMPORTANT: this model takes TWO inputs (low-res + bicubic-upsampled
    version of the same frame) and expects BGR, not RGB. Do not "simplify"
    this back to a single RGB input - that is not what the model was
    trained on and will silently produce wrong output.
    """
    low_h = int(_input_low_res.shape[2])
    low_w = int(_input_low_res.shape[3])
    bic_h = int(_input_bicubic.shape[2])
    bic_w = int(_input_bicubic.shape[3])

    low_res_input = _letterbox_resize(frame, low_w, low_h)
    bicubic_input = _letterbox_resize(frame, bic_w, bic_h)

    low_tensor = np.expand_dims(
        low_res_input.transpose(2, 0, 1), axis=0
    ).astype(np.float32)

    bicubic_tensor = np.expand_dims(
        bicubic_input.transpose(2, 0, 1), axis=0
    ).astype(np.float32)

    result = _compiled_model({
        _input_low_res: low_tensor,
        _input_bicubic: bicubic_tensor,
    })

    output = result[_output_layer]

    # Remove batch dimension, CHW -> HWC
    output = output[0].transpose(1, 2, 0)

    # Clamp back to a valid uint8 BGR image (already BGR - no color convert)
    output = np.clip(output, 0, 255).astype(np.uint8)

    return output


# ---------------------------------------------------------
# AI upscale complete video
# ---------------------------------------------------------

def ai_upscale_video(
    input_path: str,
    output_path: str,
    work_folder: str
) -> None:
    """
    AI-upscales a video using the OpenVINO super-resolution
    model.

    The input video is decoded frame-by-frame with OpenCV.
    Every frame is passed through the OpenVINO model.

    Audio is copied from the original video using FFmpeg.
    """

    os.makedirs(work_folder, exist_ok=True)

    temp_video = os.path.join(
        work_folder,
        "ai_video_no_audio.mp4"
    )

    print(f"[AI] Opening video: {input_path}")

    cap = cv2.VideoCapture(input_path)

    if not cap.isOpened():
        raise RuntimeError(
            f"[AI] Could not open video: {input_path}"
        )

    fps = cap.get(cv2.CAP_PROP_FPS)

    if not fps or fps <= 0:
        fps = 30.0

    frame_width = int(
        cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    )

    frame_height = int(
        cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    )

    total_frames = int(
        cap.get(cv2.CAP_PROP_FRAME_COUNT)
    )

    print(
        f"[AI] Input: "
        f"{frame_width}x{frame_height} "
        f"@ {fps} FPS"
    )

    print(f"[AI] Frames: {total_frames}")

    # -----------------------------------------------------
    # Determine model output size, and precompute letterbox
    # crop geometry ONCE (it's constant for the whole video)
    # so the final video keeps the source's real aspect ratio
    # instead of the model's fixed 16:9 letterboxed canvas.
    # -----------------------------------------------------

    output_shape = _output_layer.shape

    output_height = int(output_shape[2])
    output_width = int(output_shape[3])

    crop_w, crop_h, pad_x, pad_y = _compute_letterbox(
        frame_width, frame_height, output_width, output_height
    )

    print(
        f"[AI] Model output canvas: {output_width}x{output_height} "
        f"(cropping to {crop_w}x{crop_h} to preserve source aspect ratio)"
    )

    # -----------------------------------------------------
    # Create temporary video writer at the CROPPED size
    # -----------------------------------------------------

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")

    writer = cv2.VideoWriter(
        temp_video,
        fourcc,
        fps,
        (crop_w, crop_h)
    )

    if not writer.isOpened():
        cap.release()

        raise RuntimeError(
            "[AI] Could not create temporary output video."
        )

    processed = 0

    try:

        while True:

            ret, frame = cap.read()

            if not ret:
                break

            # -------------------------------------------------
            # AI inference (handles its own letterboxed resize
            # to the model's low-res + bicubic inputs internally)
            # -------------------------------------------------

            upscaled = _upscale_frame(frame)

            # Crop off the letterbox padding so the frame matches
            # the source's original aspect ratio.
            cropped = upscaled[
                pad_y:pad_y + crop_h,
                pad_x:pad_x + crop_w
            ]

            writer.write(cropped)

            processed += 1

            if processed % 30 == 0:

                if total_frames > 0:

                    percent = (
                        processed /
                        total_frames *
                        100
                    )

                    print(
                        f"[AI] "
                        f"{percent:6.2f}% "
                        f"({processed}/{total_frames})"
                    )

                else:

                    print(
                        f"[AI] "
                        f"Processed {processed} frames"
                    )

    finally:

        cap.release()
        writer.release()

    print("[AI] Video frames processed.")

    # ---------------------------------------------------------
    # Add original audio
    # ---------------------------------------------------------

    merge_cmd = [
        "ffmpeg",
        "-y",

        "-i",
        temp_video,

        "-i",
        input_path,

        "-map",
        "0:v:0",

        "-map",
        "1:a:0?",

        "-c:v",
        "libx264",

        "-preset",
        "medium",

        "-crf",
        "18",

        "-pix_fmt",
        "yuv420p",

        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-shortest",

        output_path
    ]

    print("[AI] Encoding final video...")

    result = subprocess.run(
        merge_cmd,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:

        raise RuntimeError(
            "[AI] FFmpeg failed while creating "
            f"final video:\n{result.stderr}"
        )

    # ---------------------------------------------------------
    # Cleanup
    # ---------------------------------------------------------

    if os.path.exists(temp_video):
        os.remove(temp_video)

    print(f"[AI] Finished: {output_path}")