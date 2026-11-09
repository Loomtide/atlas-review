# Mac verification for 0.25.27

Tested locally on Apple Silicon on 2026-11-09. This is a Mac verification record. Windows testing and publication remain separate release steps.

## Application and runtime

- AtlasReview.app displays AtlasReview in Finder metadata, the native window/menu, setup, and About. About reports 0.25.27.
- The identifier remains com.atlasengine.desktop. Existing data paths and the updater public key are unchanged.
- Developer ID signature verification and Gatekeeper assessment passed. Apple accepted notarization and stapler validation passed.
- The installed application completed first-run setup with an isolated backend profile. Imported a synthetic Git repository, restarted, and reopened its persisted project and branch.
- A live Codex CLI review using GPT-6.1 Sol completed on a synthetic one-file branch with a clean result. No private project source was used in that review.
- A code walkthrough generated successfully. Its step, explanation, code diff, split view, and saved read state were checked in the installed app.
- Updated About links point to Loomtide and the public GitHub documentation/license. The updater successfully read the published feed during startup. The source About button now requests a real update check instead of reporting a hardcoded success.
- Clean shutdown removed the isolated backend discovery file and stopped the bundled backend.

## Existing profile

An online SQLite backup of an existing Mac profile was tested privately. The original database was not modified by the upgrade test. The copy retained all 23 project rows, 180 branch review rows, and 499 PR review rows, passed SQLite integrity_check, and opened its populated dashboard. Hosted sync settings were removed from the test copy to prevent reporting during the test.

This verifies local data loading, not every saved provider credential or every historical review. The application identifier and keychain service are preserved. Older saved sync connections remain enabled in real profiles unless their owners clear them; fresh profiles have no hosted endpoint.

## Source checks

- Backend: the baseline 2,224 tests passed with 5 skipped. Added ZIP export and Codex stdin-error regression checks. CI exposed an uncaught EPIPE when Codex exits before accepting its auth probe; the probe now handles that pipe error and reports failure without crashing the backend.
- Frontend: production build and all 178 unit tests passed.
- MCP server: all 143 tests passed.
- Fresh-install database initialization passed.
- Bundled backend: healthy startup, Git project import, valid multipart upload, and malformed-upload recovery passed.
- Backend, frontend, MCP server, and desktop npm audits reported zero advisories, including development dependencies.
- GitHub refreshed its Rust dependency graph after the first source push and reported additional advisories. The Rust lockfile was then refreshed to patched Tauri, ZIP, TLS, archive, and serialization dependencies. See DEPENDENCY_STATUS.md for versions and the remaining upstream Linux-only glib advisory.

## Installer scope

The local Tauri DMG packaging step failed after the app was successfully signed, notarized, and stapled. A separate standard hdiutil disk image containing the verified app and an Applications link was created, Developer ID signed, notarized, and stapled. The app updater payload was signed with the preserved updater key.

No release was published and no stable updater feed was advanced by these local tests. Build all official artifacts from the intended source tag and finish the Windows installation and upgrade checklist before publication. Intel Mac execution and an actual in-app upgrade from 0.25.26 are separate checks; local Apple Silicon tests do not cover them.
