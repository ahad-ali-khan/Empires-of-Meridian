# Third-party assets

This project only vendors assets with a recorded source and license. Runtime decorative geometry is loaded through Three.js `GLTFLoader`; it is never used as authoritative simulation state.

| Asset                    | Author     | Source                                                                                                       | License | Files used                                                                            | Modification                                                                                                                                          |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nature Kit 2.1           | Kenney     | [kenney.nl/assets/nature-kit](https://kenney.nl/assets/nature-kit)                                           | CC0-1.0 | `tree_default.glb`, `tree_tall.glb`, `tree_pineTallA_detailed.glb`, `rock_largeF.glb` | Converted from the official OBJ release to binary glTF for the local loader; transforms and shared runtime flags only.                                |
| Medieval Village MegaKit | Quaternius | [quaternius.com/packs/medievalvillagemegakit.html](https://quaternius.com/packs/medievalvillagemegakit.html) | CC0-1.0 | Not yet vendored                                                                      | Official pack inspected; the standard archive requires the publisher download flow and is queued for the building pass. No unverified mirror is used. |
| Poly Haven materials     | Poly Haven | [polyhaven.com/license](https://polyhaven.com/license)                                                       | CC0-1.0 | Not yet vendored                                                                      | Candidate source only; no runtime files copied yet.                                                                                                   |
| ambientCG materials      | ambientCG  | [ambientcg.com](https://ambientcg.com/)                                                                      | CC0-1.0 | Not yet vendored                                                                      | Candidate source only; no runtime files copied yet.                                                                                                   |

## Audit notes

- Kenney's bundled `License.txt` is preserved at `apps/web/public/assets/nature/LICENSE.txt`.
- Quaternius explicitly lists the Medieval Village MegaKit as CC0 and glTF-capable, but the standard download is delivered by the official itch.io flow; no login, payment, or third-party mirror is used.
- No Age of Empires, 0 A.D., Sketchfab, OpenGameArt, Unity Asset Store, or unknown-repository assets are included.
