import { cache } from "react";
import { getSharedState } from "./shares";

/**
 * R1 W7.8 (review fix). getSharedState, memoized for one server request.
 *
 * The token pages (/s, /p, /r) call it from generateMetadata AND from the page
 * body, and the RPC is a write (it stamps last_accessed_at), so without this
 * every recipient view made two round trips and two updates. Server-only:
 * lib/shares.ts is also imported by client components.
 */
export const getSharedStateOnce = cache(getSharedState);
