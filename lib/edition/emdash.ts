// lib/edition/emdash.ts
//
// Digest-facing alias of the shared Golden Rule normalizer (lib/text/stripEmDash).
// Kept as a thin re-export so the edition's existing call sites (render.ts,
// send.ts, copyPools.ts) stay unchanged while there is ONE implementation of the
// rule. copy_kit_v2 requirement: em dashes never appear anywhere in the digest.

export { stripEmDash as stripEmDashes } from '../text/stripEmDash';
