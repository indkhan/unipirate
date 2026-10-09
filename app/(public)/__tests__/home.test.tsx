import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "../page";

describe("public home page", () => {
  it("presents the product and lets visitors start the public checker", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("See your path to a German public university.");
    expect(html).toContain('href="/check?degree=bachelor"');
    expect(html).toContain('href="/check?degree=master"');
    expect(html).toContain("Which degree level are you applying for?");
    expect(html).toContain("Step 1");
    expect(html).not.toContain("Where did you finish school?");
    expect(html).toContain("Check my eligibility");
  });
});
