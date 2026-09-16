---
name: rts-playtest-and-regression
description: Two-client tests, scene fixtures, replay checksums, and performance captures.
---

# Playtest and regression

Maintain deterministic replay fixtures with expected checksums, two-client authoritative
scenarios (join, command, reconnect, finish), and visual fixtures for camera/terrain/
HUD states. Capture frame-time, draw-call, memory, and console-error evidence under a
named device profile. Tests use local services and synthetic accounts only.

Each regression adds the smallest fixture that would have caught it. Separate flaky
presentation timing from authoritative failures; do not bless a checksum change without
an intentional versioned reason.
