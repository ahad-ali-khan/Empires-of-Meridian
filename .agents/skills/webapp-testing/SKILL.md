---
name: webapp-testing
description: Playwright-based local verification for menus, lobby, HUD, and errors.
---

# Web app testing

Test only local, explicitly started services. Inspect the rendered state before
asserting behavior, use durable role/label selectors, capture screenshots and browser
console errors, and close browsers. Do not run downloaded helpers, invoke shell
strings, access external URLs, or read `.env` files. Use `rts-playtest-and-regression`
for two-client and replay-specific coverage.
