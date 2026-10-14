/**
 * e-Taxi's mark: a steering wheel whose hub is the horn button.
 * Built from HTML/CSS shapes only (no SVG paths), so it renders the same in every browser and
 * webview. Everything is sized in em: set `size` (px) and the parts scale together.
 *
 * States (CSS in globals.css, `.sw-*`):
 *   idle  – wheel steers gently left/right; every few seconds the horn is pressed (hub dips,
 *           honk rings spread, a "Beep!" tag pops)
 *   talk  – while e-Taxi is answering: quicker steering and honks
 *   honk  – one quick honk (on click)
 * All motion stops under prefers-reduced-motion.
 */
export type WheelState = "idle" | "talk" | "honk";

export function SteeringWheel({
  size = 88,
  state = "idle",
  label = "e-Taxi",
  beep = "Beep!",
  className = "",
}: {
  size?: number;
  state?: WheelState;
  label?: string;
  beep?: string;
  className?: string;
}) {
  return (
    <span className={`sw sw-state-${state} ${className}`} style={{ fontSize: size / 10 }} aria-hidden="true">
      <span className="sw-honk" />
      <span className="sw-honk sw-honk-2" />
      <span className="sw-turn">
        <span className="sw-rim" />
        <span className="sw-grip" style={{ ["--a" as string]: "-52deg" }} />
        <span className="sw-grip" style={{ ["--a" as string]: "52deg" }} />
        <span className="sw-spoke" style={{ ["--a" as string]: "90deg" }} />
        <span className="sw-spoke" style={{ ["--a" as string]: "-90deg" }} />
        <span className="sw-spoke" style={{ ["--a" as string]: "0deg" }} />
      </span>
      <span className="sw-hub">
        <span className="sw-hub-ring" />
        <span className="sw-label">{label}</span>
      </span>
      {size >= 60 && <span className="sw-beep">{beep}</span>}
    </span>
  );
}
