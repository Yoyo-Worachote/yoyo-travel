import type { ImageInfo } from "@/lib/types";
import { Mountain } from "lucide-react";

/**
 * Licensed photo with lazy loading and a tasteful placeholder. Attribution is
 * rendered by <PhotoCredit>; cards show it compactly, detail pages in full.
 */
export function Photo({
  image,
  alt,
  className = "",
  sizes = "(min-width: 1024px) 25vw, 90vw",
  priority = false,
}: {
  image: ImageInfo | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!image) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-sage-100 via-forest-50 to-cream-200 text-sage-400 ${className}`}
        aria-hidden="true"
      >
        <Mountain className="h-10 w-10" strokeWidth={1.4} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={alt}
      width={image.width}
      height={image.height}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      referrerPolicy="no-referrer"
      className={`object-cover bg-sage-100 ${className}`}
    />
  );
}

/** Commons sometimes returns boilerplate instead of a name; keep the useful part. */
export function cleanAuthor(author: string): string {
  const cleaned = author.replace(/^No machine-readable author provided\.\s*/i, "").replace(/\s*assumed \(based on.*$/i, "").trim();
  return (cleaned || author).slice(0, 80);
}

export function PhotoCredit({
  image,
  labels,
  compact = false,
  className = "",
}: {
  image: ImageInfo;
  labels: { photoBy: string; license: string };
  compact?: boolean;
  className?: string;
}) {
  return (
    <p className={`text-[0.7rem] leading-snug text-charcoal-soft ${className}`}>
      <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
        {labels.photoBy}
      </a>
      {compact ? " · " : " — "}
      {image.licenseUrl ? (
        <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer license" className="hover:underline">
          {labels.license}
        </a>
      ) : (
        <span>{labels.license}</span>
      )}
      {!compact && <span> · Wikimedia Commons</span>}
    </p>
  );
}
