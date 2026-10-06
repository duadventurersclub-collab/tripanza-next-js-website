import { revalidatePath, revalidateTag } from "next/cache";
import type { CacheScope } from "./site-settings-types";
import { resetTourPageControls } from "./tour-page-controls";

export function invalidateAppCache(scope: CacheScope) {
  // Cache operations can update the global revision in WordPress.
  resetTourPageControls();
  revalidateTag("site-controls", { expire: 0 });
  if (scope === "all") {
    for (const tag of ["public-data", "tours", "meta-reels", "hosts", "site"]) revalidateTag(tag, { expire: 0 });
    revalidatePath("/", "layout");
    return;
  }
  if (scope === "tours") {
    revalidateTag("tours", { expire: 0 });
    for (const path of ["/", "/tours", "/trips"]) revalidatePath(path);
    revalidatePath("/tours/[slug]", "page");
  } else if (scope === "reels") {
    revalidateTag("meta-reels", { expire: 0 }); revalidatePath("/trips");
  } else if (scope === "hosts") {
    revalidateTag("hosts", { expire: 0 }); revalidatePath("/host", "layout");
  } else if (scope === "site") {
    revalidateTag("site", { expire: 0 }); revalidatePath("/", "layout");
  }
}
