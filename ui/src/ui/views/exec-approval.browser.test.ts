import { html, render } from "lit";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { i18n } from "../../i18n/index.ts";
import type { AppViewState } from "../app-view-state.ts";
import { renderExecApprovalPrompt } from "./exec-approval.ts";

const root = document.createElement("div");
document.body.append(root);

test("renders command explanation lines in Chromium approval modal", async () => {
  await i18n.setLocale("en");
  render(
    renderExecApprovalPrompt({
      execApprovalQueue: [
        {
          id: "approval-browser-1",
          kind: "exec",
          request: {
            command: 'ls | grep "stuff" | python -c \'print("hi")\'',
            host: "gateway",
            security: "allowlist",
            ask: "always",
            commandExplanationLines: [
              "Runs 3 programs: ls, grep, and python.",
              "Warning: python -c runs inline code.",
            ],
          },
          createdAtMs: Date.now() - 1_000,
          expiresAtMs: Date.now() + 60_000,
        },
      ],
      execApprovalBusy: false,
      execApprovalError: null,
      handleExecApprovalDecision: async () => undefined,
    } as unknown as AppViewState),
    root,
  );

  await expect.element(page.getByText("Runs 3 programs: ls, grep, and python.")).toBeVisible();
  await expect.element(page.getByText("Warning: python -c runs inline code.")).toBeVisible();

  render(html``, root);
});
