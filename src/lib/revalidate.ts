import "server-only";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/supabase/env";

/**
 * Public pages read the catalog through fetches tagged CATALOG_TAG (see lib/supabase/public.ts).
 * After any admin change that affects what visitors see (publish/hide/edit/images/categories) the tag is expired,
 * so the next visit re-reads the database instead of waiting for the 5-minute revalidate window.
 */

/** Server Actions: expire the tag and refresh the caller's own view immediately (read-your-own-writes). */
export function invalidateCatalogFromAction() {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
}

/** Route Handlers cannot use updateTag(); expire immediately instead. */
export function invalidateCatalogFromRoute() {
  revalidateTag(CATALOG_TAG, { expire: 0 });
  revalidatePath("/", "layout");
}
