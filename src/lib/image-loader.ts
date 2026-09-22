"use client";

type ImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

export default function tripanzaImageLoader({ src, width, quality }: ImageLoaderProps) {
  try {
    const source = new URL(src);

    if (source.hostname === "tripanza.com" && source.pathname.startsWith("/wp-content/uploads/")) {
      const optimized = new URL(`https://i0.wp.com/${source.hostname}${source.pathname}`);
      optimized.searchParams.set("w", String(Math.min(width, 1600)));
      optimized.searchParams.set("quality", String(quality ?? 65));
      optimized.searchParams.set("ssl", "1");
      return optimized.toString();
    }
  } catch {
    // Relative and data URLs should continue to be served by their original source.
  }

  return src;
}
