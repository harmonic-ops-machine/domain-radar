import { describe, expect, it } from "vitest";
import {
  buildDomainOfferLinks,
  getVerificationProofUrl,
} from "@/lib/offers/sources";

describe("multi-source domain offers and registry proof links", () => {
  it("returns 5 registrar purchase sources for available domains with direct buy URLs", () => {
    const offers = buildDomainOfferLinks({
      fqdn: "truthcipher.com",
      tld: ".com",
      status: "available",
      estimatedValueUsd: 950,
    });
    expect(offers.length).toBe(5);
    expect(offers.every((o) => o.kind === "registrar")).toBe(true);
    expect(offers.map((o) => o.source)).toEqual([
      "Porkbun",
      "Cloudflare",
      "Namecheap",
      "Spaceship",
      "Dynadot",
    ]);
    expect(offers[0].url).toContain("truthcipher.com");
  });

  it("returns 5 aftermarket/broker offer sources for expensive or registered domains", () => {
    const offers = buildDomainOfferLinks({
      fqdn: "openai.com",
      tld: ".com",
      status: "registered",
      estimatedValueUsd: 72000,
    });
    expect(offers.length).toBe(5);
    expect(offers.map((o) => o.source)).toEqual([
      "Afternic",
      "Sedo",
      "GoDaddy",
      "Atom",
      "DropCatch",
    ]);
    expect(offers[0].priceLabel).toContain("$72k");
  });

  it("builds direct RDAP proof links for RDAP TLDs and ICANN lookup for .co WHOIS", () => {
    const comProof = getVerificationProofUrl("truthcipher.com", ".com");
    expect(comProof.url).toContain("rdap.verisign.com");
    const coProof = getVerificationProofUrl("t.co", ".co");
    expect(coProof.label).toContain("whois.registry.co");
  });
});
