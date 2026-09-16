"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { useAssetUrl } from "@/hooks/useAssetUrl";
import { toGrayscaleUrl, toInvertedUrl, toOneBitUrl, toSmallUrl } from "@/utils/image";
import { cn } from "@/utils/cn";

export type RenderMode = "normal" | "grayscale" | "onebit" | "inverted" | "small";

/**
 * Logo presentation surface.
 *
 * Alternate renders are produced on a canvas rather than with CSS filters, so
 * the black-and-white and small-size previews are honest tests of the artwork
 * rather than a visual approximation of one.
 */
export function ConceptImage({
  assetId,
  alt,
  mode = "normal",
  className,
  imgClassName,
  padded = true,
  dark = false,
  bare = false,
}: {
  assetId?: string;
  alt: string;
  mode?: RenderMode;
  className?: string;
  imgClassName?: string;
  padded?: boolean;
  dark?: boolean;
  /** Drop the studio's stage background — for surfaces that supply their own. */
  bare?: boolean;
}) {
  const baseUrl = useAssetUrl(assetId);
  /* Tagged with the inputs that produced it, so switching mode never shows a
     stale render and no reset-to-null pass is needed. */
  const [derived, setDerived] = useState<{
    key: string;
    url: string | null;
  } | null>(null);

  const derivedKey = `${baseUrl ?? ""}::${mode}`;

  useEffect(() => {
    if (!baseUrl || mode === "normal") return;
    let active = true;
    const transform =
      mode === "grayscale"
        ? toGrayscaleUrl
        : mode === "onebit"
          ? toOneBitUrl
          : mode === "inverted"
            ? toInvertedUrl
            : (src: string) => toSmallUrl(src, 48);

    void transform(baseUrl)
      .then((url) => {
        if (active) setDerived({ key: derivedKey, url });
      })
      .catch(() => {
        if (active) setDerived({ key: derivedKey, url: null });
      });

    return () => {
      active = false;
    };
  }, [baseUrl, mode, derivedKey]);

  const src =
    mode === "normal"
      ? baseUrl
      : derived?.key === derivedKey
        ? derived.url
        : null;

  if (!assetId) {
    return (
      <div
        className={cn(
          "flex aspect-square items-center justify-center rounded-lg border border-dashed border-line bg-surface-2",
          className,
        )}
      >
        <ImageOff size={18} className="text-faint" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex aspect-square items-center justify-center overflow-hidden",
        bare ? "bg-transparent" : dark ? "rounded-lg bg-[#16161c]" : "logo-stage",
        padded && "p-3",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={cn(
            "h-full w-full object-contain transition-opacity duration-300",
            mode === "small" && "image-render-pixelated",
            imgClassName,
          )}
          style={mode === "small" ? { imageRendering: "pixelated" } : undefined}
        />
      ) : (
        <div className={cn("h-full w-full", baseUrl ? "skeleton rounded" : "")} />
      )}
    </div>
  );
}
