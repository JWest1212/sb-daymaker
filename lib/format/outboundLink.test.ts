import { describe, it, expect } from "vitest";
import { outboundLink } from "./outboundLink";

describe("outboundLink", () => {
  it("returns null when there is no URL (never a dead label)", () => {
    expect(outboundLink({ type: "event", buy_url: null })).toBeNull();
    expect(outboundLink({ type: "place", buy_url: "   " })).toBeNull();
  });

  it("labels a free event with a source page 'Event details' (the LOTG fix)", () => {
    const link = outboundLink({
      type: "event",
      free: true,
      buy_url: "https://sbplibrary.org/events/game-day",
    });
    expect(link?.label).toBe("Event details ↗");
  });

  it("labels a priced event 'Get tickets'", () => {
    const link = outboundLink({
      type: "event",
      free: false,
      price_band: "$$",
      buy_url: "https://thebowl.example.com/show",
    });
    expect(link?.label).toBe("Get tickets ↗");
  });

  it("labels any ticket-host URL 'Get tickets' regardless of price flags", () => {
    expect(outboundLink({ type: "event", free: null, buy_url: "https://www.axs.com/events/123" })?.label).toBe(
      "Get tickets ↗",
    );
    expect(
      outboundLink({ type: "event", buy_url: "https://www.ticketmaster.com/event/456" })?.label,
    ).toBe("Get tickets ↗");
  });

  it("labels a place/venue website 'Visit website' (the MOXI fix)", () => {
    const link = outboundLink({ type: "place", buy_url: "https://moxi.org" });
    expect(link?.label).toBe("Visit website ↗");
  });

  it("labels a reservation host 'Reserve'", () => {
    expect(outboundLink({ type: "place", buy_url: "https://www.opentable.com/r/the-lark" })?.label).toBe(
      "Reserve ↗",
    );
    expect(outboundLink({ type: "place", buy_url: "https://resy.com/cities/sb/loquita" })?.label).toBe(
      "Reserve ↗",
    );
  });

  it("preserves the exact href", () => {
    const url = "https://example.com/path?a=1&b=2";
    expect(outboundLink({ type: "place", buy_url: url })?.href).toBe(url);
  });
});
