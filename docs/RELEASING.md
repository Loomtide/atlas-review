# Release maintenance

Official releases are built from version tags in this repository. Version 0.25.27 displays AtlasReview and produces AtlasReview.app. The legacy identifier, data paths, keychain service, and updater verification key remain unchanged. Keep package.json, its lock, Cargo.toml, Cargo.lock, and tauri.conf.json versions aligned. Use increasing versions; do not reset the version while supporting existing installations.

## Credentials

Contributor builds use `npm run desktop:build:unsigned` and need no release secrets. Official builds require `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Keep the private key outside the repository and preserve the matching public key for existing users.

Optional Apple signing requires `APPLE_CERTIFICATE` (base64 P12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID`, and `KEYCHAIN_PASSWORD`. Configure all of them or none. Windows code signing is optional through `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`, and `WINDOWS_TIMESTAMP_URL`; installer updater signing is required independently. Inspect the workflow for the supported certificate format.

Store secrets in GitHub Actions secrets. The normal workflow publishes to this repository using its short-lived GitHub token; no cross-repository publication token is needed. Pull request checks do not receive signing secrets.

## Procedure

1. Run CI and review the version and toolchain changes. Tag the exact intended main commit with `v<version>` and push the tag.
2. The workflow builds Windows x64 and Mac Apple Silicon/Intel, validates required files and signatures, creates fixed-name download aliases, and writes SHA256SUMS and source metadata.
3. Inspect the draft release, CI logs, signing status, and installers. Test fresh installs and an upgrade on each supported platform before publishing the draft using `gh release edit <tag> --draft=false --latest` (omit `--latest` for prereleases).
4. Validate unauthenticated download links and updater manifests after publication. Stable builds use the latest release's `stable.json` asset. Do not mark a prerelease as latest stable.

Releases are assembled as drafts so failed or partial builds cannot advance the public updater feed. Do not publish a draft that has missing platforms or failed checks. A maintainer-authorized partial release may retain verified older platform assets using the procedure below. A published release must include its exact source SHA, checksums, license notices, and accurate code-signing status. OS signing does not guarantee Windows SmartScreen reputation.

## Existing users

Old builds use `AvinashP/AtlasEngineRelease` and its stable manifest. Keep that repository and manifest available. Only after testing an upgrade with the preserved updater key should maintainers update the legacy manifest to reference the new signed release assets. This compatibility publication is a separate maintainer action with access to the old repository. Never delete the old feed during the launch.

A legacy release mirrored for download continuity must explicitly identify its origin and must not claim to have been built from the new curated source tree.

## Rename compatibility in 0.25.27

On Mac, the updater replaces the contents of the installed app at its existing path. It does not rename an existing AtlasEngine.app directory. A manual installation of AtlasReview.app changes the Finder name. Quit the old app first and keep only one active copy. Both names use the same existing profile; do not delete Application Support when replacing the application.

Windows MSI retains upgrade code `cd5cbea9-357e-5ffc-800c-5ed5759fd6c6`, derived from the previous product name. NSIS uses the pinned Tauri CLI 2.12.4 template in `apps/desktop/src-tauri/windows/installer.nsi`, retaining the AtlasEngine registry keys while displaying AtlasReview. Review this template against upstream when upgrading the CLI. The template is distributed under its included MIT license. Old shortcuts pointing at the same installation are removed after installation.

Before publishing, test both EXE and MSI fresh installations and upgrades from 0.25.26 on Windows. Confirm one installed-app entry, working shortcuts, preserved projects/provider settings, backend shutdown, and updater behavior. These checks require a Windows machine.

The local publish command creates a draft in Loomtide/atlas-review using the existing source tag and all three platform artifacts. It never creates a replacement source history, pushes source commits, or advances the stable feed. Prefer the tagged GitHub Actions workflow for official builds.

## Partial platform releases

Versioned plans under `release-plans/` explicitly identify prebuilt platform releases. The tag validation job checks the plan and skips automatic compilation and draft assembly for that tag. This prevents the full-build workflow from replacing or mislabelling retained installers. Normal version tags without a plan still use the complete build matrix.

For 0.25.27, Apple Silicon uses the tested signed local build from source commit a55f5bd5d1b0545f053776e4ccf0239b6e654be1. Intel Mac and Windows retain their byte-identical 0.25.26 installers and updater signatures. The release tag also includes the release plan and assembly tooling; SOURCE.json records each binary's actual source commit separately. Old versioned installer names remain unchanged and fixed-name download aliases are copied from the same verified bytes.

Download the previous release's assets, SOURCE.json, and SHA256SUMS into a private temporary directory. Put the verified current Mac build, MAC_BUILD.json, platform dependency notices, Node license, and their checksums into the current artifact directory. Run:

```sh
node scripts/prepare-partial-release.mjs --plan release-plans/v0.25.27.json --current-dir release-staging/0.25.27 --previous-dir /absolute/path/to/previous-assets --output-dir release-staging/0.25.27-public --tag-commit "$(git rev-parse HEAD)"
```

The assembler requires an empty output directory and verifies checksums, per-platform source commits, and updater signatures against the preserved application key. It produces platform-specific provenance and fresh SHA256SUMS. Create a draft from the pushed release tag, inspect its assets and notes, then publish it as latest. Keep the old release available because the retained feed references its immutable assets.

Tauri's static updater manifest has a single version number, not separate platform versions. Never advertise 0.25.27 with a 0.25.26 Windows or Intel installer: it would offer an update repeatedly. This partial release copies stable.json byte-for-byte from 0.25.26. Existing automatic updates remain truthful and compatible; the new Apple Silicon 0.25.27 build is a manual download. Once all supported platforms have builds at the same version, a later full release can advance the shared feed again. Old Windows and Intel binaries do not contain the Mac-only branding, dependency, or auth-probe fixes.
