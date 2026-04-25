<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=000000&height=200&section=header&text=Trading%20Sensei%20XR&fontSize=50&fontColor=ffffff" />

  <h2>An immersive, gesture-controlled Mixed Reality trading platform.</h2>
  
  <p>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18.x-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
    <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-4.x-646cff?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-3.x-06b6d4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" /></a>
    <a href="https://developers.google.com/mediapipe"><img src="https://img.shields.io/badge/MediaPipe-Hands-ea4335?style=for-the-badge&logo=google&logoColor=white" alt="MediaPipe" /></a>
  </p>
  
  <p>
    <strong>Trading Sensei XR</strong> transforms your physical desk into a hyper-advanced algorithmic trading battle-station. By utilizing standard webcams and local neural networks, it projects live market data, biometric tracking, and interactive learning environments directly into an Augmented Reality (AR) or Virtual Reality (VR) heads-up display.
  </p>
</div>

---

## 🔥 Key Features

- 🥽 **Dual Modalities (AR / VR)**: Seamlessly toggle between spatial physical passthrough logic (AR) and a dedicated 4-quadrant immersive void (VR) at the push of a button.
- 🖐️ **Minority-Report Gestures**: Powered by Google MediaPipe. Hover over glassmorphic panels, hold a fist for 2 seconds to grab/lock UI, and perform dual-hand pinches to zoom into candlestick charts.
- 🧠 **Biometric Stress Engine**: Real-time localized facial expression tracking (`face-api.js`) monitors trader tilt. Sensei actively intervenes if dangerous tilt/stress thresholds are breached.
- 🎮 **Interactive Market Structure Simulator**: A gamified, Netflix-style branching tutorial teaching Higher-Highs, Higher-Lows, and Break of Structure mechanics.
- 🧪 **Strategy Lab Dashboard**: A sleek, parameter-based backtesting environment featuring real-time expectancy / PNL calculations and deterministic dummy logs.
- 🖱️ **Synthetic Cursor Driver**: Use your primary index finger as a frictionless cursor. Pinch to click elements natively within the 3D space.

---

## 🏗️ Systems Architecture

Trading Sensei XR is built on a unidirectional React data flow, orchestrating massive arrays of high-frequency DOM manipulation without sacrificing framerates. Heavy ML processing is performed frame-by-frame and throttled elegantly mapping to the React Component Tree.

```mermaid
graph TD;
    WebGL_Canvas[Vite/React Engine] --> XR_Router
    
    XR_Router --> Mode_AR(AR Spatial Mode)
    XR_Router --> Mode_VR(VR Immersive Mode)

    subgraph "Neural Handlers (30fps loop)"
    Face_API[face-api.js] --> Emotional_Engine
    MediaPipe[MediaPipe Hands] --> Gesture_Engine
    end

    Emotional_Engine --> Bio_Feedback_UI
    Gesture_Engine --> Object_Manipulation
    Gesture_Engine --> Synthetic_Cursor

    Mode_AR --> Gesture_Cards(Floating & Draggable Panels)
    Mode_VR --> 4_Quadrant_Cockpit(Trade Simulator Window)
    Mode_VR --> Bento_Dashboard(Strategy Lab Lab)
```

---

## 🖐️ Gesture & Interaction Pipeline

We map abstract 3D hand coordinates into hyper-tactile mathematical triggers. The custom `useGestureCards` hook translates precise Euclidean distances into unified UI states.

```mermaid
sequenceDiagram
    participant User
    participant Webcam
    participant NeuralNet as MediaPipe Loop
    participant CoreState as React Context
    participant UILayer as DOM / CSS

    User->>Webcam: Performs Dual-Pinch Zoom
    Webcam->>NeuralNet: 30fps Video Stream
    NeuralNet->>CoreState: 21 Landmarks per Hand (x,y,z)
    CoreState->>CoreState: Process Euclidean Distances (Thumb-to-Index)
    CoreState->>CoreState: Calculate Anchor Midpoints
    CoreState->>UILayer: Broadcasts Synthetic 'mousedown'
    UILayer->>User: Renders Custom CSS transform: scale()
```

---

## 🎨 Design Philosophy

### Monochrome Glassmorphism
The aesthetic revolves around a strict **Monochrome HUD** style using raw HSL tokens and radical WebKit backdrop filters. Color is stripped away to reduce cognitive fatigue, reserving `Green` (Success) and `Red` (Destructive) purely as absolute market signals. 

### JetBrains Mono
Structural markers, timestamps, and active PNL readouts belong purely to the `font-mono` family equipped with intense letter-spacing (`tracking-[0.3em]`) to recreate the feeling of a military-grade aerospace terminal.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A modern browser with WebRTC (Webcam) support (Chrome / Edge recommended for MediaPipe optimization).

### Local Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tohraan/trading-sensei.git
   cd trading-sensei
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173` (or the port Vite provides).
5. **Approve Webcam Permissions** to immediately initialize the neural engines and enter AR Mode.

---

## 🛠 Tech Stack

| Domain | Technology | Use Case |
| ----------------- | ----------------------- | -------------------------------------------------------- |
| **Core View** | React 18, Vite | Lightning fast rendering, concurrent UI execution |
| **Tracking** | MediaPipe Hands, Face-api | On-device, privacy-centric computer vision AI |
| **Styling** | Tailwind CSS | Utility-first rapid composition, custom `.xr-panel` layers |
| **Charting** | Recharts / SVG Native | High-frequency responsive candlestick graphing |
| **Language** | TypeScript | Strict schema enforcement, complex coordinate math typing |

---

<div align="center">
  <p>Built with precision and discipline. <br/> <b>May the trend be your friend.</b></p>
</div>
