import { cn } from "@/components/ui/cn";

const ICON_SRC = "/brand/rivvet-icon.png";
const WORDMARK_SRC = "/brand/rivvet-wordmark.png";

/** Canonical network mark (cyan → mint graph) */
export function RivvetIcon({
  className = "size-8",
  alt = "Rivvet AI",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={ICON_SRC}
      alt={alt}
      width={1024}
      height={1024}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

/** Full RIVVET AI wordmark — dark type for light surfaces */
export function RivvetWordmark({
  className,
  alt = "Rivvet AI",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={WORDMARK_SRC}
      alt={alt}
      width={1600}
      height={320}
      className={cn("h-auto w-auto object-contain object-left", className)}
      draggable={false}
    />
  );
}

/**
 * Wordmark inverted for deep-ink sidebar / dark chrome.
 * Source asset is dark navy on transparent.
 */
export function RivvetWordmarkOnDark({
  className,
  alt = "Rivvet AI",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={WORDMARK_SRC}
      alt={alt}
      width={1600}
      height={320}
      className={cn(
        "h-auto w-auto object-contain object-left brightness-0 invert",
        className,
      )}
      draggable={false}
    />
  );
}

/** @deprecated use RivvetIcon — kept for any residual imports */
export function RivvetMark({ className = "size-8" }: { className?: string }) {
  return <RivvetIcon className={className} alt="" />;
}

/** Compact brand lockup: icon + wordmark */
export function RivvetBrand({
  variant = "light",
  className,
  showWordmark = true,
}: {
  variant?: "light" | "dark";
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <RivvetIcon className="size-8 shrink-0 sm:size-9" alt="" />
      {showWordmark &&
        (variant === "dark" ? (
          <RivvetWordmarkOnDark className="h-5 w-auto max-w-[148px] sm:h-[22px]" />
        ) : (
          <RivvetWordmark className="h-5 w-auto max-w-[148px] sm:h-[22px]" />
        ))}
    </div>
  );
}
