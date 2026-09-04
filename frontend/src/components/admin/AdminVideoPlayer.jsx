import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import Hls from "hls.js";
import { AlertCircle, LoaderCircle } from "lucide-react";

export default function AdminVideoPlayer({
  src,
  poster,
  title,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) {
      setLoading(false);
      setError("No video stream is available.");
      return undefined;
    }

    setLoading(true);
    setError("");

    let hls = null;

    const nativeHls =
      video.canPlayType("application/vnd.apple.mpegurl");

    if (nativeHls) {
      video.src = src;

      const onLoaded = () => {
        setLoading(false);
      };

      const onError = () => {
        setLoading(false);
        setError("Unable to load the video stream.");
      };

      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);

      return () => {
        video.pause();
        video.removeAttribute("src");
        video.load();

        video.removeEventListener(
          "loadedmetadata",
          onLoaded
        );

        video.removeEventListener("error", onError);
      };
    }

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data?.fatal) {
          setLoading(false);
          setError("Unable to load the video stream.");
        }
      });

      return () => {
        video.pause();

        if (hls) {
          hls.destroy();
        }

        hlsRef.current = null;
      };
    }

    setLoading(false);
    setError(
      "This browser does not support HLS playback."
    );

    return undefined;
  }, [src]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster={poster || undefined}
        className="aspect-video w-full bg-black"
        aria-label={title || "Video player"}
      />

      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-black/50">
          <div className="flex items-center gap-2 text-xs text-[#d9d0d2]">
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
            Loading video…
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6">
          <div className="max-w-sm text-center">
            <AlertCircle
              size={28}
              className="mx-auto text-[#e08a6b]"
            />

            <p className="mt-3 text-sm text-[#e08a6b]">
              {error}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}