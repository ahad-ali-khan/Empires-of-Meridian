---
name: test-driven-development
description: Test-first workflow for deterministic simulation and service behavior.
---

# Test-driven development

Write the smallest failing test for an observable rule, implement only enough to pass,
then refactor with the suite green. For simulation work, tests must assert exact
fixed-point state and checksums, not just visual outcomes. Keep tests local and
hermetic; fixtures contain no credentials or production data.
