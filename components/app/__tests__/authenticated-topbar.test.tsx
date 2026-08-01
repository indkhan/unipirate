import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../assistant-sidebar", () => ({
  AssistantSidebar: () => null,
}));

vi.mock("../theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("../user-menu", () => ({
  UserMenu: () => null,
}));

import { AuthenticatedTopbar } from "../authenticated-topbar";

describe("AuthenticatedTopbar", () => {
  it("links the logo to the signed-in dashboard", () => {
    const html = renderToStaticMarkup(
      <AuthenticatedTopbar
        email="student@example.com"
        initialAssistantUsed={0}
      />,
    );

    expect(html).toContain('href="/dashboard"');
  });
});
