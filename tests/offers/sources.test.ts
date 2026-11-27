import { describe, expect, it } from "vitest";
import { buildDomainOffers } from "@/lib/offers/sources";

describe("multi-source domain offers", () => {
  it("returns registrar offers with pricing, cheapest badge, and direct URLs for available domains", () => {
    const offers = buildDomainOffers("truthcipher.com", ".com", "available");
    const registrars = offers.filter((o) => o.kind === "registrar");
    expect(registrars.length).toBeGreaterThanOrEqual(4);
    const cf = registrars.find((o) => o.source === "Cloudflare Registrar");
    expect(cf?.url).toContain("truthcipher.com");
    expect(cf?.year1Usd).toBeCloseTo(11.17, 2);
    expect(cf?.cheapest).toBe(true);
    expect(offers.some((o) => o.kind === "aftermarket")).toBe(true);
  });

  it("prioritizes aftermarket/broker offer links for registered expensive domains", () => {
    const offers = buildDomainOffers("openai.com", ".com", "registered");
    expect(offers[0].kind).toBe("aftermarket");
    const sources = offers.map((o) => o.source);
    expect(sources).toEqual(
      expect.arrayContaining(["Afternic", "Sedo", "GoDaddy Broker", "Atom"])
    );
    expect(offers.every((o) => o.url.startsWith("https://"))).toBe(true);
  });
});
