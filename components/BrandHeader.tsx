import Link from "next/link";
import { HeaderSearch } from "@/components/explore/HeaderSearch";
import "./brand-header.css";

/** Global brand header — "Golden Hour" design. Sticky, AA-compliant, server component.
    Rendered once in the (app) group layout; appears on every browse page.
    Home Rework spec §9 — gains a deterministic search control, top-right. */
export default function BrandHeader() {
  return (
    <header className="sbd-brandhdr">
      <div className="sbd-brandhdr__row">
        <Link
          href="/"
          className="sbd-brandhdr__logo"
          aria-label="SB Daymaker — Explore"
        >
          <span className="sbd-brandhdr__mark" aria-hidden="true">
            <span className="sbd-brandhdr__glint" />
            <span className="sbd-brandhdr__sun" />
          </span>
          <span className="sbd-brandhdr__word">
            <span className="sbd-brandhdr__eyebrow">Santa Barbara</span>
            <span className="sbd-brandhdr__wordmark">
              Day<b>maker</b>
            </span>
          </span>
        </Link>
        <HeaderSearch />
      </div>
      <div className="sbd-brandhdr__horizon" aria-hidden="true" />
    </header>
  );
}
