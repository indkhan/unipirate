import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "../page";

describe("public home page", () => {
  it("presents the product and lets visitors start the public checker", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("See your path to a German public university.");
    expect(html).toContain('href="/check?country=in"');
    expect(html).toContain('href="/check?country=pk"');
    expect(html).toContain('href="/check?country=sa"');
    expect(html).toContain("Check my eligibility");
  });
});
