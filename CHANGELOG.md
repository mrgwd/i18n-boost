# Changelog

All notable changes to this project will be documented in this file.

## 1.1.1 (2026-01-09)

### Added

- Automatically detects the correct translation file structure.

- Supports both single-file and multi-file-per-locale setups (e.g. locales/ar.json or locales/ar/\*.json) with zero configuration.

### Improved

- Redesigned configuration experience.

- Improved autocomplete suggestions by removing the redundant entry that matches the user's current input.

### Fixed

- Fixed a bug with unused keys cache not updating correctly.

- Fixed a bug where newly added translation keys did not appear immediately in autocomplete suggestions.

- Fixed a bug where the commented keys were being detected as used keys.

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
  - CHANGELOG: Followed keep-changelog guidelines.
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