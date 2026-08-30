import { cn } from "@/lib/utils";

/**
 * Abstract vehicle illustration.
 *
 * Deliberately a stylised silhouette rather than a photograph: this is an
 * independent demo marketplace, so it must never present manufacturer imagery
 * that could imply an official listing. The body colour follows the selected
 * paint so the configurator still gives live feedback.
 */
export function VehicleVisual({
  bodyColor = "#4a4d52",
  variant = "sedan",
  className,
  wheelAccent = "#1b1c1f",
}: {
  bodyColor?: string;
  variant?: "sedan" | "suv" | "truck";
  className?: string;
  wheelAccent?: string;
}) {
  const roof =
    variant === "truck"
      ? "M148 96 L196 64 L268 64 L296 96 Z"
      : variant === "suv"
        ? "M136 96 L176 56 L318 56 L356 96 Z"
        : "M140 96 L188 58 L306 58 L348 96 Z";

  const body =
    variant === "truck"
      ? "M56 150 Q56 116 96 110 L148 96 L296 96 L330 104 L330 150 Q330 160 320 160 L66 160 Q56 160 56 150 Z"
      : variant === "suv"
        ? "M52 152 Q52 112 96 104 L136 96 L356 96 L410 112 Q432 120 432 152 Q432 162 422 162 L62 162 Q52 162 52 152 Z"
        : "M48 150 Q48 114 94 106 L140 96 L348 96 L406 114 Q428 122 428 150 Q428 160 418 160 L58 160 Q48 160 48 150 Z";

  return (
    <svg
      viewBox="0 0 480 200"
      className={cn("w-full", className)}
      role="img"
      aria-label="Stylised vehicle illustration"
    >
      {/* Ground shadow */}
      <ellipse cx="240" cy="176" rx="190" ry="10" fill="currentColor" opacity="0.08" />

      {/* Glasshouse */}
      <path d={roof} fill="currentColor" opacity="0.22" />

      {/* Body */}
      <path d={body} fill={bodyColor} />

      {/* Highlight along the shoulder line */}
      <path
        d={variant === "truck" ? "M64 128 L326 128" : "M60 130 L422 130"}
        stroke="#ffffff"
        strokeOpacity="0.18"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Wheels */}
      {(variant === "truck" ? [122, 282] : [128, 344]).map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="160" r="26" fill={wheelAccent} />
          <circle cx={cx} cy="160" r="12" fill="currentColor" opacity="0.35" />
        </g>
      ))}

      {/* Lamps */}
      <rect x="44" y="118" width="16" height="7" rx="3.5" fill="#ffffff" opacity="0.75" />
      <rect
        x={variant === "truck" ? "316" : "418"}
        y="118"
        width="14"
        height="7"
        rx="3.5"
        fill="#ff5a5a"
        opacity="0.8"
      />
    </svg>
  );
}

/** Maps a catalogue slug onto the silhouette that best fits it. */
export function variantForSlug(slug: string): "sedan" | "suv" | "truck" {
  if (slug === "cybertruck") return "truck";
  if (slug === "model-y" || slug === "model-x") return "suv";
  return "sedan";
}
