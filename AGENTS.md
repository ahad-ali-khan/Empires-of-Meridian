# Empires of Meridian agent guidance

Before changing a subsystem, read the matching project skill in `.agents/skills`.
`rts-*` skills are authoritative over general-purpose skills when their guidance
conflicts. All skills are documentation only: do not execute downloaded helpers, make
network calls, access secrets, or install dependencies unless the user explicitly
authorizes that action for the current task.

| Work area                                    | Required skill                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| Fixed-tick state, replay, checksum           | `rts-deterministic-simulation`                                                |
| Rooms, commands, reconnect, validation       | `rts-authoritative-multiplayer`                                               |
| Navigation, formations, terrain traversal    | `rts-pathfinding-formations`                                                  |
| Map/biome generation                         | `rts-procedural-world`                                                        |
| Three.js scene/rendering/assets/VFX          | `rts-threejs-renderer`, plus the matching `threejs-*` and RTS specialty skill |
| Assets and animations                        | `rts-asset-pipeline`, `rts-ip-compliance`                                     |
| Content data and balance                     | `rts-content-and-balance`                                                     |
| Lobbies, chat, voice                         | `rts-lobbies-and-social`                                                      |
| HUD, hotkeys, accessibility                  | `rts-ui-accessibility`                                                        |
| Test, replay, playtest, performance evidence | `rts-playtest-and-regression`, `verification-before-completion`               |
