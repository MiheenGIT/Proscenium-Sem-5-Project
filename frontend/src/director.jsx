import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
 
const BACKEND_URL = "http://localhost:8000/directors/latest-video";
 
export default function TestPlayer() {
  const videoRef = useRef(null);
  const [title, setTitle] = useState("Loading latest video...");
  const [status, setStatus] = useState("Fetching from backend...");
  const [levels, setLevels] = useState([]); // list of {index, height} for quality buttons
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = auto
  const hlsRef = useRef(null); // so buttons can access the hls instance later
 
  useEffect(() => {
    let hls;
 
    async function loadLatestVideo() {
      try {
        const res = await fetch(BACKEND_URL);
        const data = await res.json();
 
        if (data.error) {
          setStatus("Error: " + data.error);
          return;
        }
 
        setTitle("Now playing: " + data.title);
        setStatus("Loaded URL: " + data.hlsManifestUrl);
 
        const video = videoRef.current;
 
        if (Hls.isSupported()) {
          hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(data.hlsManifestUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play();
            // build the list of available quality levels for our buttons
            const levelList = hls.levels.map((lvl, index) => ({
              index,
              height: lvl.height,
            }));
            setLevels(levelList);
          });
          hls.on(Hls.Events.LEVEL_SWITCHED, (event, switchData) => {
            setCurrentLevel(switchData.level);
          });
          hls.on(Hls.Events.ERROR, (event, errData) => {
            setStatus("HLS error: " + errData.details);
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Safari has native HLS support, doesn't need hls.js
          video.src = data.hlsManifestUrl;
          video.play();
        } else {
          setStatus("HLS not supported in this browser");
        }
      } catch (err) {
        setStatus("Fetch failed: " + err.message);
      }
    }
 
    loadLatestVideo();
 
    // cleanup: destroy hls instance if component unmounts
    return () => {
      if (hls) hls.destroy();
    };
  }, []);
 
  function handleQualityChange(levelIndex) {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 = auto, 0/1/... = forced level
    }
  }
 
  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 800, margin: "30px auto" }}>
      <h2>{title}</h2>
      <div style={{ margin: "10px 0", fontFamily: "monospace", color: "#555" }}>
        {status}
      </div>
      <video
        ref={videoRef}
        controls
        muted
        style={{ width: "100%", background: "#000" }}
      />
 
      {levels.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <strong>Quality: </strong>
          <button
            onClick={() => handleQualityChange(-1)}
            style={{
              fontWeight: currentLevel === -1 ? "bold" : "normal",
              marginRight: 8,
            }}
          >
            Auto
          </button>
          {levels.map((lvl) => (
            <button
              key={lvl.index}
              onClick={() => handleQualityChange(lvl.index)}
              style={{
                fontWeight: currentLevel === lvl.index ? "bold" : "normal",
                marginRight: 8,
              }}
            >
              {lvl.height}p
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
 