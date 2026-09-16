---
name: systematic-debugging
description: Evidence-led debugging without secret exposure.
---

# Systematic debugging

Reproduce, collect the smallest relevant evidence, trace the data/control flow to its
first bad transition, form one falsifiable hypothesis, and verify the fix with a
regression test. Never print environment variables, secret presence, tokens, cookies,
or full production payloads. Prefer redacted, structured diagnostics and deterministic
replay fixtures for desyncs.
