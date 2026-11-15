# v1.0.0 — prepared release notes

Monster Hatchery is a browser-based monster collection game made with HTML, CSS, and vanilla JavaScript.

- Hatch two egg types and discover 13 monster species.
- Collect favorites, feed and level monsters, and evolve them twice.
- Complete achievements and battle with attack, defend, and heal actions.
- Save progress locally, retaining original v1 save compatibility.
- Pause safely on unreadable saves, warn about failed writes, and prevent stale tabs from replacing newer progress.

## Stabilization findings

The unfinished local Phase 3B edit replaced the core game script with combat-only code and duplicated declarations in `battle.js`, preventing normal startup. The original local work was committed before restoring the established Phase 3A game.

The earlier loader caught parsing/storage errors and returned a fresh game. The next saved action could therefore overwrite unreadable progress. Regression tests reproduced this unsafe behavior, along with stale-tab overwrites. Both paths now protect the stored value. Invalid existing fields are not silently discarded; missing optional fields in older saves receive defaults.

The precise cause of the player's reported historical reset is unconfirmed: the original browser origin and LocalStorage could not be inspected. Browser/profile/origin changes can expose a different save without a code defect. No existing browser progress was cleared or changed during stabilization.

## Release gate

- Run the syntax checks and regression suite documented in README.md.
- Complete the browser refresh/reopen smoke test on a separate test origin. Browser automation was blocked because Computer Use could not confidently determine Chrome's current URL; native layout and real-browser persistence remain unverified.
- Review and approve the stabilization pull request before merging.
- After approval and merge, tag the reviewed merge commit as `v1.0.0` and publish these notes as a GitHub release.
- If GitHub Pages is configured, verify its deployment uses the merged commit and smoke-test its public URL. Do not migrate or clear existing player storage during verification.

No additional features or runtime dependencies were introduced.
