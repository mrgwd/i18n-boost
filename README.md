# <img width="36" height="36" alt="image" src="https://raw.githubusercontent.com/mrgwd/i18n-boost/main/src/images/icon.webp" /> I18n Boost

Designed to supercharge your internationalization (i18n) workflow. Integrates directly into your editor to help you **navigate, manage, and use translation keys faster**. Helps you **boost** your productivity and avoid errors.

## 🚀 Features

### 1. **Autocomplete for `t("...")`**

Get real-time suggestions for translation keys while typing inside your translation function calls.

![autocomplete](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/autocomplete.gif)

**How it works:**

- Start typing `t("` or `t('` in a `.jsx`, `.tsx`, `.vue`, or supported file
- i18n-boost will list all available keys from your locale files
- Suggestions filter automatically as you type

---

### 2. **Ctrl+Click to Jump to Locale**

Navigate directly from a translation key in your code to its definition in your locale file.

![ctrl-click](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/ctrl-click.gif)

**How it works:**

- Hold `Ctrl` (or `Cmd` on Mac) and click a key in `t('...')`
- The editor opens your **default locale file** at the correct line

---

### 3. **Unused Translation Keys Warnings**

Scans your codebase to find translation keys that are defined but never used. Just like the `no-unused-vars` rule in ESLint, but for i18n keys!

![unused-keys](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/unused-keys.gif)

**How it works:**

- Open your locale file (e.g., `en.json`).
- Will automatically highlight unused keys.
- In-sync with your code, updating as you edit.

---

### 4. **Copy Full Translation Key**

Effortlessly copy the full nested key path of any translation value in your locale file.

![copy-key-path](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/copy-key-path.gif)

**How it works:**

- Open your locale file (e.g., `en.json`)
- Right-click on a value
- Select **"Copy Full Translation Key"** — done!

## ⚙️ Configuration

On the first run, i18n-boost will prompt you to create a `i18nboost.config.json` file in your workspace root.

| Configuration Option | Description                                                   | Possible Values                                                | Default Value                        |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `localesPath`        | Path to translation files folder (relative to workspace root) | Any valid relative path string                                 | `'src/i18n'`                         |
| `defaultLocale`      | Default locale to navigate to on Ctrl+Click                   | Must be one of your `supportedLocales`                         | `'en'`                               |
| `supportedLocales`   | All locales supported in your project                         | Array of locale codes (strings)                                | `['en', 'ar', 'fr', 'es', 'de']`     |
| `functionNames`      | Function names that indicate translation keys                 | Array of function name strings                                 | `['t', 'translate', '$t', 'i18n.t']` |
| `fileNamingPattern`  | Pattern for locale file naming                                | `'locale.json'`, `'locale/common.json'`, `'locale/index.json'` | `'locale.json'`                      |
| `enabled`            | Enable/disable extension features                             | `true` or `false`                                              | `true`                               |

## 🛠 Installation

### From VS Code Marketplace

1. Open **Extensions** in VS Code (`Ctrl+Shift+X`)
2. Search for `I18n Boost`
3. Click **Install**

### From VSIX File

1. Download the latest `.vsix` file from [Releases](https://github.com/mrgwd/i18n-boost/releases)
2. Open VS Code
3. Go to **Extensions** → **...** → **Install from VSIX**
4. Select the downloaded `.vsix` file

### From Source (Development)

1. Clone this repository:

   ```bash
   git clone https://github.com/mrgwd/i18n-boost.git
   cd i18n-boost
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile:

   ```bash
   npm run compile
   ```

4. Press `F5` in VS Code to launch the extension in a new Extension Development Host window.

## 🔧 Quick Setup

After installation, i18n-boost will automatically prompt you to create a configuration file. You can also manually create one:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `I18n Boost: Create config file`
3. Configure your project settings in the generated `i18nBoost.config.ts` file

## 🐛 Troubleshooting

### Extension not working?

1. **Check your configuration**: Ensure `i18nBoost.config.ts` exists and is properly configured
2. **Verify file paths**: Make sure `localesPath` points to your translation files
3. **Check file naming**: Ensure your locale files match the `fileNamingPattern` setting
4. **Restart VS Code**: Sometimes a restart is needed after configuration changes

### Autocomplete not showing?

1. **Verify function names**: Check that your translation function names are in the `functionNames` array
2. **Check file types**: Ensure you're working in supported file types (`.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`)
3. **Trigger manually**: Try typing `t("` and then `Ctrl+Space` to trigger suggestions

### Navigation not working?

1. **Check default locale**: Ensure your `defaultLocale` file exists
2. **Verify key exists**: Make sure the translation key exists in your default locale file
3. **Check function names**: Ensure the function name matches your configuration

### Unused keys not detected?

1. **Wait for scan**: The extension scans your codebase when files are saved
2. **Check file patterns**: Ensure your code files match the supported patterns
3. **Verify function names**: Make sure your translation function calls use the configured function names

## 🗂 Project Structure

```
i18n-boost/
│
├── package.json               # Extension metadata & activation
├── tsconfig.json              # TypeScript configuration
├── README.md                  # This file
├── CHANGELOG.md               # Release notes
├── src/
│   ├── extension.ts           # Entry point
│   ├── commands/              # Command implementations
│   ├── providers/             # Hover, completion, definition providers
│   ├── types/                 # Type definitions
│   ├── utils/                 # Utility functions
│   └── images/                # Icons and images
└── tests/                     # Unit tests
```

## 🤝 Contributing

PRs are welcome!
Please check the [Contributing Guide](CONTRIBUTING.md) for details.

## 🔒 Privacy Policy

**I18n Boost respects your privacy:**

- **No data collection**: The extension does not collect, store, or transmit any personal data
- **Local processing only**: All translation key analysis happens locally in your VS Code instance
- **No telemetry**: No usage statistics or analytics are collected
- **Open source**: The entire codebase is open source and auditable

The extension only reads your project files to provide i18n functionality and does not communicate with external servers.

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 📫 Contact

You can reach out via [email](mogdwd@gmail.com) or [Twitter](https://twitter.com/_muhammedr).
