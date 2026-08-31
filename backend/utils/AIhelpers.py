import os
import subprocess

# ---------------------------------------------------------
# AI upscale video using TensorFlow ESPCN through Docker
# ---------------------------------------------------------

def ai_upscale_video_espcn(
    input_path: str,
    output_path: str,
    work_folder: str
) -> None:
    """
    AI-upscale a video using the TensorFlow ESPCN model
    through the miratmu/ffmpeg-tensorflow Docker image.

    ESPCN performs 2x super-resolution on the luma (Y) plane.
    This is the verified, working configuration — confirmed
    against a real test clip. scale_factor values other than 2,
    or swapping in a different model (e.g. vespcn.pb, which is
    a temporal/multi-frame model and not a drop-in replacement
    for single-image ESPCN), are unverified and should be tested
    standalone via `docker run` before changing this function.

    For yuv420p:
        Y -> 2x
        U -> 2x
        V -> 2x

    This produces correctly sized yuv420p output — chroma must
    scale by the same factor as luma relative to its own
    original size, since chroma planes are already half the
    resolution of luma in yuv420p.
    """

    os.makedirs(work_folder, exist_ok=True)

    input_filename = os.path.basename(input_path)
    output_filename = os.path.basename(output_path)

    input_abs = os.path.abspath(input_path)
    output_abs = os.path.abspath(output_path)
    work_abs = os.path.abspath(work_folder)

    if not os.path.exists(input_abs):
        raise RuntimeError(
            f"[AI-ESPCN] Input video does not exist: {input_abs}"
        )

    print(
        f"[AI-ESPCN] Starting ESPCN x2 upscaling: "
        f"{input_abs}"
    )

    filter_graph = (
        "[0:v]"
        "format=pix_fmts=yuv420p,"
        "extractplanes=y+u+v"
        "[y][u][v];"

        "[y]"
        "sr="
        "dnn_backend=tensorflow:"
        "scale_factor=2:"
        "model=/models/espcn.pb"
        "[y_scaled];"

        "[u]"
        "scale=iw*2:ih*2:flags=lanczos"
        "[u_scaled];"

        "[v]"
        "scale=iw*2:ih*2:flags=lanczos"
        "[v_scaled];"

        "[y_scaled][u_scaled][v_scaled]"
        "mergeplanes=0x001020:yuv420p"
        "[merged]"
    )

    cmd = [
        "docker",
        "run",
        "--rm",
        "-u",
        "0",

        "-v",
        f"{work_abs}:/data",

        "-w",
        "/data",

        "miratmu/ffmpeg-tensorflow",

        "-i",
        f"/data/{input_filename}",

        "-filter_complex",
        filter_graph,

        "-map",
        "[merged]",

        "-map",
        "0:a?",

        "-sws_flags",
        "lanczos",

        "-c:v",
        "libx264",

        "-preset",
        "fast",

        "-crf",
        "18",

        "-pix_fmt",
        "yuv420p",

        "-c:a",
        "aac",

        "-b:a",
        "128k",

        "-y",
        f"/data/{output_filename}"
    ]

    print("[AI-ESPCN] Running Docker/FFmpeg...")

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        raise RuntimeError(
            "[AI-ESPCN] Docker/FFmpeg failed:\n"
            f"{result.stderr}"
        )

    if not os.path.exists(output_abs):
        raise RuntimeError(
            "[AI-ESPCN] FFmpeg completed but output was not created: "
            f"{output_abs}"
        )

    print(
        f"[AI-ESPCN] Finished: {output_abs}"
    )


def ai_upscale_video_espcn_4x(
    input_path: str,
    output_path: str,
    work_folder: str
) -> None:
    """
    Reaches ~4x total upscaling by running the verified 2x ESPCN
    pass twice in sequence.

    NOT the same as passing scale_factor=4 to a single pass —
    ESPCN's sub-pixel convolution layer has its output channel
    count fixed at training time, so a checkpoint trained for 2x
    cannot correctly produce 4x just by changing the option value.
    Chaining two confirmed-working 2x passes is the safe way to
    reach a higher net factor without assuming untested model
    behavior.

    Trade-offs, stated plainly:
      - Takes roughly 2x as long as a single pass (two full
        Docker/FFmpeg runs instead of one).
      - Each pass is a genuine learned reconstruction step, so
        artifacts from the first pass can compound slightly in
        the second rather than averaging out. Worth comparing
        actual output quality against the single 2x version
        before deciding this is worth shipping.
    """

    os.makedirs(work_folder, exist_ok=True)

    intermediate_path = os.path.join(work_folder, "ai_upscaled_2x_intermediate.mp4")

    print("[AI-ESPCN-4x] Pass 1 of 2 (2x)...")
    ai_upscale_video_espcn(input_path, intermediate_path, work_folder)

    print("[AI-ESPCN-4x] Pass 2 of 2 (2x again, net ~4x)...")
    ai_upscale_video_espcn(intermediate_path, output_path, work_folder)

    if os.path.exists(intermediate_path):
        os.remove(intermediate_path)

    print(f"[AI-ESPCN-4x] Finished: {os.path.abspath(output_path)}")