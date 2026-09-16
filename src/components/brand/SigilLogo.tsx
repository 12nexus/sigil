import { cn } from "@/utils/cn";

/**
 * The SIGIL identity.
 *
 * The mark is a chamfered block "S" set as a seal: three horizontal bars with
 * two counter-turns, cut at the outer top-left and bottom-right to give the
 * form direction. It is drawn as real vector geometry — this application
 * argues that AI raster output is not a production logo, so its own mark is
 * built the way it tells users to build theirs.
 */

const GLYPH_PATH =
  "M18 22 L24 16 L46 16 L46 23 L25 23 L25 28.5 L46 28.5 L46 42 L40 48 L18 48 L18 41 L39 41 L39 35.5 L18 35.5 Z";

export function SigilMark({
  size = 32,
  className,
  mono = false,
}: {
  size?: number;
  className?: string;
  mono?: boolean;
}) {
  const gradientId = mono ? undefined : "sigil-glyph-gradient";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="SIGIL"
    >
      {!mono && (
        <defs>
          <linearGradient id={gradientId} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#F6E3BA" />
            <stop offset="0.5" stopColor="#DDB876" />
            <stop offset="1" stopColor="#B2803C" />
          </linearGradient>
          <linearGradient id="sigil-seal-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1E1E27" />
            <stop offset="1" stopColor="#08080B" />
          </linearGradient>
        </defs>
      )}
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="18"
        fill={mono ? "currentColor" : "url(#sigil-seal-gradient)"}
      />
      {!mono && (
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="17"
          fill="none"
          stroke="#DDB876"
          strokeOpacity="0.22"
          strokeWidth="1"
        />
      )}
      <path d={GLYPH_PATH} fill={mono ? "#fff" : `url(#${gradientId})`} />
    </svg>
  );
}

/** The glyph alone, inheriting colour — used in dense chrome and favicons. */
export function SigilGlyph({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size * (30 / 34)}
      height={size}
      viewBox="17 15 30 34"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="SIGIL"
    >
      <path d={GLYPH_PATH} fill="currentColor" />
    </svg>
  );
}

export function SigilWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-[13px] tracking-[0.34em]",
    md: "text-[15px] tracking-[0.36em]",
    lg: "text-[22px] tracking-[0.38em]",
  };
  return (
    <span
      className={cn(
        "font-sans font-semibold text-ink select-none",
        sizes[size],
        className,
      )}
    >
      SIGIL
    </span>
  );
}

export function SigilLockup({
  size = "md",
  showTagline = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}) {
  const markSize = size === "sm" ? 26 : size === "md" ? 32 : 46;
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <SigilMark size={markSize} />
      <span className="flex flex-col leading-none">
        <SigilWordmark size={size} />
        {showTagline ? (
          <span className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-faint">
            AI Brand Identity Studio
          </span>
        ) : null}
      </span>
    </span>
  );
}
