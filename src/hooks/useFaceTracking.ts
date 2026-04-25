import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

export interface FaceFrame {
  // bounding box in container/display coords (already mirrored, scaled to object-cover)
  box: { x: number; y: number; width: number; height: number };
  // landmark points in container/display coords
  landmarks: { x: number; y: number }[];
  expressions: faceapi.FaceExpressions;
}

export type FaceStatus = "loading" | "denied" | "no-face" | "tracking";

interface Opts {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  enabled: boolean;
}

let modelsPromise: Promise<void> | null = null;
const ensureModels = () => {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    })();
  }
  return modelsPromise;
};

export const useFaceTracking = ({ videoRef, containerRef, enabled }: Opts) => {
  const [status, setStatus] = useState<FaceStatus>("loading");
  const [frame, setFrame] = useState<FaceFrame | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const smoothedRef = useRef<FaceFrame | null>(null);

  useEffect(() => {
    let mounted = true;
    ensureModels()
      .then(() => mounted && setModelReady(true))
      .catch((e) => console.warn("face models failed", e));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("no-face");
        }
      } catch (e) {
        console.warn("camera denied", e);
        setStatus("denied");
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, videoRef]);

  useEffect(() => {
    if (!enabled || !modelReady || status === "denied") return;
    let raf = 0;
    let last = 0;
    const SMOOTH = 0.62; // higher = more responsive, less lag

    const tick = async (t: number) => {
      const v = videoRef.current;
      const c = containerRef.current;
      if (v && c && v.readyState === 4 && t - last > 33) {
        last = t;
        const det = await faceapi
          .detectSingleFace(v, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.35 }))
          .withFaceLandmarks()
          .withFaceExpressions();

        if (det) {
          const cw = c.clientWidth;
          const ch = c.clientHeight;
          const vw = v.videoWidth || 1280;
          const vh = v.videoHeight || 720;
          const scale = Math.max(cw / vw, ch / vh);
          const dispW = vw * scale;
          const dispH = vh * scale;
          const offX = (cw - dispW) / 2;
          const offY = (ch - dispH) / 2;
          const project = (px: number, py: number) => ({
            x: offX + (vw - px) * scale, // mirror X
            y: offY + py * scale,
          });

          const b = det.detection.box;
          const projected = project(b.x + b.width, b.y);
          const newBox = {
            x: projected.x,
            y: projected.y,
            width: b.width * scale,
            height: b.height * scale,
          };
          const landmarks = det.landmarks.positions.map((p) => project(p.x, p.y));

          // Smooth (lerp toward target)
          const prev = smoothedRef.current;
          let smoothBox = newBox;
          let smoothLandmarks = landmarks;
          if (prev) {
            smoothBox = {
              x: prev.box.x + (newBox.x - prev.box.x) * SMOOTH,
              y: prev.box.y + (newBox.y - prev.box.y) * SMOOTH,
              width: prev.box.width + (newBox.width - prev.box.width) * SMOOTH,
              height: prev.box.height + (newBox.height - prev.box.height) * SMOOTH,
            };
            if (prev.landmarks.length === landmarks.length) {
              smoothLandmarks = landmarks.map((p, i) => ({
                x: prev.landmarks[i].x + (p.x - prev.landmarks[i].x) * SMOOTH,
                y: prev.landmarks[i].y + (p.y - prev.landmarks[i].y) * SMOOTH,
              }));
            }
          }

          const f: FaceFrame = {
            box: smoothBox,
            landmarks: smoothLandmarks,
            expressions: det.expressions,
          };
          smoothedRef.current = f;
          setFrame(f);
          setStatus("tracking");
        } else {
          setStatus((s) => (s === "tracking" ? "no-face" : s));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, modelReady, status, videoRef, containerRef]);

  return { status, frame, modelReady };
};
