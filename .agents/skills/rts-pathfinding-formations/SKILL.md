---
name: rts-pathfinding-formations
description: Flow fields, avoidance, formations, terrain blocking, and deterministic recovery.
---

# Pathfinding and formations

Maintain an authoritative integer-grid navigation representation distinct from terrain
meshes. Define terrain semantics once: cliff and water blocking, passable classes,
costs, footprint clearance, and dynamic blockers. Flow fields/path searches must use
stable neighbor order, integer costs, and deterministic tie breaks.

Formation slots derive from a stable unit-ID order and target-space pattern. Local
avoidance can alter short movement proposals but must resolve conflicts deterministically
and have bounded recovery (repath, slot reassignment, then a visible stuck state).
Test choke points, mixed footprints, cliffs, water edges, and command replay equality.
