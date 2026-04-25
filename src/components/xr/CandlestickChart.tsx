import { useEffect, useRef, useState } from "react";

export type Timeframe = "1m" | "5m" | "15m" | "1H" | "4H" | "1D";

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Props {
  symbol?: string;
  timeframe: Timeframe;
  zoomX?: number; // 1 = default, >1 = zoom in (fewer candles)
  zoomY?: number;
  showEMA?: [number, number]; // e.g. [9, 21]
  height?: number;
  tpPrice?: number;
  slPrice?: number;
  staticCandles?: Candle[];
}

const TF_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1H": 60 * 60_000,
  "4H": 4 * 60 * 60_000,
  "1D": 24 * 60 * 60_000,
};

const TF_VOLATILITY: Record<Timeframe, number> = {
  "1m": 25,
  "5m": 60,
  "15m": 110,
  "1H": 220,
  "4H": 480,
  "1D": 950,
};

const TF_DRIFT: Record<Timeframe, number> = {
  "1m": 0.5,
  "5m": 1.2,
  "15m": 2,
  "1H": 4,
  "4H": 8,
  "1D": 18,
};

const seedCandles = (tf: Timeframe, count: number): Candle[] => {
  const candles: Candle[] = [];
  const now = Date.now();
  const tfMs = TF_MS[tf];
  let price = 67500;
  const vol = TF_VOLATILITY[tf];
  const drift = TF_DRIFT[tf];
  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * tfMs;
    const open = price;
    const direction = Math.sin(i / 8) + (Math.random() - 0.5);
    const close = open + direction * drift + (Math.random() - 0.5) * vol;
    const high = Math.max(open, close) + Math.random() * vol * 0.6;
    const low = Math.min(open, close) - Math.random() * vol * 0.6;
    const v = 100 + Math.random() * 900;
    candles.push({ t, o: open, h: high, l: low, c: close, v });
    price = close;
  }
  return candles;
};

const ema = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = data[0];
  for (let i = 0; i < data.length; i++) {
    prev = i === 0 ? data[0] : data[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
};

export const CandlestickChart = ({
  symbol = "BTC/USD",
  timeframe,
  zoomX = 1,
  zoomY = 1,
  showEMA = [9, 21],
  height = 320,
  tpPrice,
  slPrice,
  staticCandles,
}: Props) => {
  const [candles, setCandles] = useState<Candle[]>(() => staticCandles || seedCandles(timeframe, 120));
  const tfRef = useRef(timeframe);

  // Reset when timeframe changes or staticCandles changes
  useEffect(() => {
    if (staticCandles) {
      setCandles(staticCandles);
      return;
    }
    if (tfRef.current !== timeframe) {
      tfRef.current = timeframe;
      setCandles(seedCandles(timeframe, 120));
    }
  }, [timeframe, staticCandles]);

  // Live tick simulation — updates last candle, rolls over at TF interval
  useEffect(() => {
    if (staticCandles) return;
    const tickRate = Math.max(250, Math.min(900, TF_MS[timeframe] / 60));
    const id = setInterval(() => {
      setCandles((prev) => {
        if (!prev.length) return prev;
        const next = prev.slice();
        const last = { ...next[next.length - 1] };
        const vol = TF_VOLATILITY[timeframe] * 0.18;
        const tick = (Math.random() - 0.5) * vol;
        last.c = last.c + tick;
        last.h = Math.max(last.h, last.c);
        last.l = Math.min(last.l, last.c);
        last.v += Math.random() * 8;
        next[next.length - 1] = last;

        // Rollover
        const tfMs = TF_MS[timeframe];
        if (Date.now() - last.t >= tfMs) {
          const open = last.c;
          const direction = (Math.random() - 0.5);
          const close = open + direction * TF_DRIFT[timeframe];
          next.push({
            t: last.t + tfMs,
            o: open,
            h: Math.max(open, close),
            l: Math.min(open, close),
            c: close,
            v: 100 + Math.random() * 200,
          });
          if (next.length > 200) next.shift();
        }
        return next;
      });
    }, tickRate);
    return () => clearInterval(id);
  }, [timeframe]);

  // Visible window based on zoomX
  const visibleCount = Math.max(20, Math.min(candles.length, Math.round(80 / zoomX)));
  const visible = candles.slice(-visibleCount);

  const closes = visible.map((c) => c.c);
  const ema1 = ema(closes, showEMA[0]);
  const ema2 = ema(closes, showEMA[1]);

  const maxP = Math.max(...visible.map((c) => c.h));
  const minP = Math.min(...visible.map((c) => c.l));
  const range = maxP - minP || 1;
  const pad = range * 0.1 * (1 / zoomY);
  const yMax = maxP + pad;
  const yMin = minP - pad;
  const yRange = yMax - yMin;

  const W = 800;
  const H = height;
  const chartH = H - 50; // reserve volume area
  const volH = 40;
  const cw = W / visible.length;
  const bw = Math.max(1, cw * 0.7);

  const yPx = (p: number) => ((yMax - p) / yRange) * chartH;
  const fmtPrice = (p: number) => p.toLocaleString("en-US", { maximumFractionDigits: 0 });

  const last = visible[visible.length - 1];
  const change = last && visible[0] ? ((last.c - visible[0].o) / visible[0].o) * 100 : 0;
  const isUp = change >= 0;

  const maxVol = Math.max(...visible.map((c) => c.v)) || 1;

  // Crossover detection
  const lastCrossover = (() => {
    for (let i = ema1.length - 1; i > 0; i--) {
      const prevDiff = ema1[i - 1] - ema2[i - 1];
      const diff = ema1[i] - ema2[i];
      if (Math.sign(prevDiff) !== Math.sign(diff)) {
        return { i, type: diff > 0 ? "bull" : "bear" as "bull" | "bear" };
      }
    }
    return null;
  })();

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {/* Grid */}
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line key={f} x1={0} y1={chartH * f} x2={W} y2={chartH * f} stroke="hsl(var(--hud-line) / 0.06)" />
        ))}

        {/* Price labels */}
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((f) => {
          const p = yMax - yRange * f;
          return (
            <text
              key={f}
              x={W - 4}
              y={chartH * f + 3}
              textAnchor="end"
              fontSize="9"
              fontFamily="JetBrains Mono"
              fill="hsl(var(--foreground) / 0.45)"
            >
              {fmtPrice(p)}
            </text>
          );
        })}

        {/* TP / SL bands */}
        {tpPrice !== undefined && tpPrice <= yMax && tpPrice >= yMin && (
          <>
            <line x1={0} y1={yPx(tpPrice)} x2={W} y2={yPx(tpPrice)} stroke="hsl(var(--success))" strokeOpacity={0.5} strokeDasharray="3 4" />
            <text x={4} y={yPx(tpPrice) - 3} fontSize="9" fontFamily="JetBrains Mono" fill="hsl(var(--success))">TP {fmtPrice(tpPrice)}</text>
          </>
        )}
        {slPrice !== undefined && slPrice <= yMax && slPrice >= yMin && (
          <>
            <line x1={0} y1={yPx(slPrice)} x2={W} y2={yPx(slPrice)} stroke="hsl(var(--destructive))" strokeOpacity={0.5} strokeDasharray="3 4" />
            <text x={4} y={yPx(slPrice) - 3} fontSize="9" fontFamily="JetBrains Mono" fill="hsl(var(--destructive))">SL {fmtPrice(slPrice)}</text>
          </>
        )}

        {/* Candles */}
        {visible.map((c, i) => {
          const x = i * cw + cw / 2;
          const up = c.c >= c.o;
          const stroke = up ? "hsl(var(--success))" : "hsl(var(--destructive))";
          const yO = yPx(c.o);
          const yC = yPx(c.c);
          const yH = yPx(c.h);
          const yL = yPx(c.l);
          return (
            <g key={i}>
              <line x1={x} y1={yH} x2={x} y2={yL} stroke={stroke} strokeWidth={1} />
              <rect
                x={x - bw / 2}
                y={Math.min(yO, yC)}
                width={bw}
                height={Math.max(1, Math.abs(yC - yO))}
                fill={up ? "hsl(var(--success) / 0.85)" : "hsl(var(--destructive) / 0.85)"}
              />
            </g>
          );
        })}

        {/* EMA lines */}
        <polyline
          points={ema1.map((v, i) => `${i * cw + cw / 2},${yPx(v)}`).join(" ")}
          fill="none"
          stroke="hsl(var(--hud-line) / 0.85)"
          strokeWidth={1}
        />
        <polyline
          points={ema2.map((v, i) => `${i * cw + cw / 2},${yPx(v)}`).join(" ")}
          fill="none"
          stroke="hsl(var(--hud-line) / 0.4)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {/* Crossover marker */}
        {lastCrossover && (
          <g transform={`translate(${lastCrossover.i * cw + cw / 2}, ${yPx(ema1[lastCrossover.i])})`}>
            <circle r={6} fill="none" stroke={lastCrossover.type === "bull" ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
            <text x={8} y={3} fontSize="9" fontFamily="JetBrains Mono" fill={lastCrossover.type === "bull" ? "hsl(var(--success))" : "hsl(var(--destructive))"}>
              {lastCrossover.type === "bull" ? "▲ BULL CROSS" : "▼ BEAR CROSS"}
            </text>
          </g>
        )}

        {/* Last price marker */}
        {last && (
          <>
            <line x1={0} y1={yPx(last.c)} x2={W} y2={yPx(last.c)} stroke="hsl(var(--foreground) / 0.4)" strokeDasharray="1 3" />
            <rect x={W - 60} y={yPx(last.c) - 8} width={56} height={14} fill="hsl(var(--foreground))" />
            <text x={W - 32} y={yPx(last.c) + 2} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono" fill="hsl(var(--background))">
              {fmtPrice(last.c)}
            </text>
          </>
        )}

        {/* Volume bars */}
        <g transform={`translate(0, ${chartH + 8})`}>
          {visible.map((c, i) => {
            const x = i * cw + cw / 2;
            const h = (c.v / maxVol) * volH;
            const up = c.c >= c.o;
            return (
              <rect
                key={i}
                x={x - bw / 2}
                y={volH - h}
                width={bw}
                height={h}
                fill={up ? "hsl(var(--success) / 0.35)" : "hsl(var(--destructive) / 0.35)"}
              />
            );
          })}
        </g>
      </svg>

      {/* Header overlay */}
      <div className="absolute top-2 left-3 font-mono text-[10px] tracking-[0.25em] text-foreground/70 flex items-center gap-3 pointer-events-none">
        <span>{symbol}</span>
        <span className="text-foreground">{last && fmtPrice(last.c)}</span>
        <span className={isUp ? "text-success" : "text-destructive"}>
          {isUp ? "+" : ""}{change.toFixed(2)}%
        </span>
        <span className="text-foreground/40">· {timeframe}</span>
      </div>
    </div>
  );
};
