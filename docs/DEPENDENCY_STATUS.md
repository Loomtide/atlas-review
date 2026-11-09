# Dependency audit status

Audit date: 2026-11-09. These results describe the checked lockfiles and supported targets, not a guarantee that the application has no vulnerabilities.

Backend, frontend, MCP server, and desktop npm audits report zero advisories, including development dependencies. Multer is updated to the patched 2.x series, UUID to 11.1.1, and Archiver to 8.x. ZIP export uses the new ZipArchive API and has an integration regression check. Overrides for Glob and Minimatch apply only to the affected newer major versions, retaining the older API expected by legacy development tools. Rust bytes is updated to 1.11.1.

## Remaining upstream Linux advisory

Tauri 2.x depends on the GTK 0.18 family on Linux, including glib 0.18.5. [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html) affects glib::VariantStrIter and is fixed in glib 0.20.0. The GTK dependencies require glib 0.18, so forcing 0.20 into Cargo.lock would not fix that dependency chain and could break compilation. No unsupported dependency replacement is applied.

The supported releases are Mac and Windows. Neither target includes glib. Linux builds remain outside the supported release matrix until the upstream GTK dependency chain can be upgraded or a reviewed backport is adopted. The GitHub glib alert remains open and documented.

## Recheck

Run `npm audit --prefix backend`, `npm audit --prefix frontend`, `npm audit --prefix mcp-review-server`, and `npm audit --prefix apps/desktop`. Use `cargo tree --manifest-path apps/desktop/src-tauri/Cargo.toml --target all -i glib` to inspect the upstream Linux chain. Audit results can change as new advisories are published.
