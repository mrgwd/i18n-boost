# Changelog

All notable changes to this project will be documented in this file.

## 1.2.0 (2026-02-21)

### Added

- **Monorepo Support**: `i18nBoost.localesPath` now accepts an array of paths or glob patterns (e.g., `["apps/*/src/locales", "packages/shared/locales"]`).
- **Group-based Isolation**: Intelligently resolves relevant locales based on the specific file you are editing. Apps can see their own locales and shared locales, but remain isolated from sibling apps.
- **Context-Aware Features**: Autocomplete, Hover, Navigation (Ctrl+Click), and Unused Keys seamlessly support multi-root setups and shared libraries.

### Fixed

- Fixed duplicate locale links in the hover menu when the same locale exists across multiple roots.

## 1.1.1 (2026-01-17)

### Added

- Automatic detection of translation file structure.
- New `i18nBoost.keyStrategy` setting to choose between `filename` and `function` for including file names in translation keys.
- Support for multi-file-per-locale setups (e.g., `locales/ar/*.json`) with zero configuration.

### Improved

- Redesigned configuration experience.
- Refined autocomplete suggestions by removing redundant entries that match the current input.
- Enhanced README with documentation for new features and improved clarity.

### Fixed

- Fixed a bug where the unused keys cache was not updating correctly.
- Fixed an issue where newly added translation keys did not appear immediately in autocomplete suggestions.
- Fixed a bug where commented-out keys were being detected as used keys.

## 1.1.0 (2025-10-25)

### Added

- Instantly jump to the same translation key in another locale file (e.g., from `ar.json` → `en.json`) with one click.
- Switched entirely from `i18nboost.config.ts` file to the VS Code Settings System.

### Improved

- Reduced Extension Size by over 40% (from 325kb to 137kb), leading to faster installation and load times.
- Simplified Configuration:
  - Removed `i18nboost.config.ts` file — everything now lives inside VS Code settings.
  - Removed `supportedLocales` from config — locales are now automatically detected based on `localesPath` and `fileNamingPattern`.
- Better Docs:
  - README: Added badges and supported frameworks.
  - CHANGELOG: Followd keep-changelog guidelines.
- Reduced complexity and improved overall extension performance and responsiveness.

### Removed

- `i18nboost.config.ts` file.
- `supportedLocales` from config.

## 1.0.1 (2025-09-11)

### Fixed

- Fixed an issue with unused keys cache not updating correctly.
- Fixed a bug where the autocomplete would not show suggestions on first install.

## 1.0.0 (2025-08-27)

### Added

- Initial public release.
- Copy full translation key from locale files.
- Autocomplete for translation keys in supported files.
- Ctrl+Click navigation to locale definition.
- Command to show available locales.
- Config file creation and management.
