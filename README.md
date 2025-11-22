<div align="center"> <img width="36" height="36" alt="image"  src="https://raw.githubusercontent.com/mrgwd/i18n-boost/main/src/images/icon.webp" /> <h1> I18n Boost</h1> </div>

<div align="center">

Supercharge your internationalization (i18n) workflow. Integrates directly into your editor to help you **navigate, manage, and use translation keys faster**.

<p>
<img src="https://img.shields.io/badge/lightweight-138Kb-63ba84" alt="Download Size" />
<a href="https://marketplace.visualstudio.com/items?itemName=mrgwd.i18n-boost" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/mrgwd.i18n-boost?color=blue&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
<a href="https://open-vsx.org/extension/mrgwd/i18n-boost" target="__blank"><img src="https://img.shields.io/open-vsx/dt/mrgwd/i18n-boost?color=a38eed" alt="Open VSX Downloads" /></a>

</div>

</p>

## Supported Frameworks

<div align="center">

<img width="360" height="53" alt="Supported Framworks" src="https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/supported_framworks.png" />

</div>

## Features

### 1. **Autocomplete for `t("...")`**

Get real-time suggestions for translation keys while typing inside your translation function calls.

![autocomplete](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/autocomplete.gif)

**How it works:**

- Start typing `t("` or `t('` in a `.jsx`, `.tsx`, `.vue`, or supported file
- i18n-boost will list all available keys from your locale files
- Suggestions filter automatically as you type

---

### 2. **Easy Switch**

When hovering over a translation key in your code, you will see a list of available locales.

![autocomplete](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/easy-switch.gif)

**How it works:**

- Hover over a translation key in your code
- Click on the locale you want to switch to

---

### 3. **Ctrl+Click to Jump to Locale**

Navigate directly from a translation key in your code to its definition in your locale file.

![ctrl-click](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/ctrl-click.gif)

**How it works:**

- Hold `Ctrl` (or `Cmd` on Mac) and click a key in `t('...')`
- The editor opens your **default locale file** at the correct line

---

### 4. **Unused Translation Keys Warnings**

Scans your codebase to find translation keys that are defined but never used. Just like the `no-unused-vars` rule in ESLint, but for i18n keys!

![unused-keys](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/unused-keys.gif)

**How it works:**

- Open your locale file (e.g., `en.json`).
- Will automatically highlight unused keys.
- In-sync with your code, updating as you edit.

---

### 5. **Copy Full Translation Key**

Effortlessly copy the full nested key path of any translation value in your locale file.

![copy-key-path](https://raw.githubusercontent.com/mrgwd/i18n-boost/main/assets/copy-key-path.gif)

**How it works:**

- Open your locale file (e.g., `en.json`)
- Right-click on a value
- Select **"Copy Full Translation Key"** — done!

## ⚙️ Configuration

I18n Boost uses VS Code's built-in settings system for configuration. You can configure it through:

- **Settings UI**: `Ctrl+,` → Search for "I18n Boost"
- **Workspace Settings**: `.vscode/settings.json` (project-specific)
- **User Settings**: Global settings for all projects

### Settings

| Setting                       | Description                                                   | Default Value                        |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| `i18nBoost.localesPath`       | Path to translation files folder (relative to workspace root) | `"src/i18n"`                         |
| `i18nBoost.defaultLocale`     | Default locale to navigate to on Ctrl+Click                   | `"en"`                               |
| `i18nBoost.functionNames`     | Function names that indicate translation keys                 | `["t", "translate", "$t", "i18n.t"]` |
| `i18nBoost.fileNamingPattern` | Pattern for locale file naming                                | `"locale.json"`                      |
| `i18nBoost.enabled`           | Enable/disable extension features                             | `true`                               |

### File Naming Patterns

- `"locale.json"`: `en.json`, `fr.json`, `de.json`
- `"locale/common.json"`: `en/common.json`, `fr/common.json`
- `"locale/index.json"`: `en/index.json`, `fr/index.json`

### Example Configuration

**`.vscode/settings.json`** (workspace-specific):

```json
{
  "i18nBoost.localesPath": "./translations",
  "i18nBoost.defaultLocale": "en",
  "i18nBoost.functionNames": [
    "t",
    "translate",
    "$t",
    "i18n.t",
    "t.raw",
    "t.rich"
  ],
  "i18nBoost.fileNamingPattern": "locale.json",
  "i18nBoost.enabled": true
}
```

**Note**: Starting from version 1.1.0 locales are automatically discovered from your filesystem based on the `localesPath` and `fileNamingPattern` settings. No manual configuration needed!

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

1. **Install the extension** from the VS Code Marketplace
2. **Configure your settings** via VS Code Settings (`Ctrl+,`) or `.vscode/settings.json`
3. **Start using** autocomplete and navigation features immediately!

The extension will automatically discover your locale files based on your configuration.

## 🐛 Troubleshooting

<details>
 <summary><b>Extension not working?</b></summary>

1.  **Check your settings**: Ensure I18n Boost is enabled in VS Code settings

2.  **Verify file paths**: Make sure `i18nBoost.localesPath` points to your translation files
3.  **Check file naming**: Ensure your locale files match the `i18nBoost.fileNamingPattern` setting
4.  **Restart VS Code**: Sometimes a restart is needed after configuration changes
</details>

<details>
 <summary><b>Autocomplete not showing?</b></summary>

5.  **Verify function names**: Check that your translation function names are in the `i18nBoost.functionNames` array
6.  **Check file types**: Ensure you're working in supported file types (`.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`)
7.  **Trigger manually**: Try typing `t("` and then `Ctrl+Space` to trigger suggestions
</details>

<details>
 <summary><b>Navigation not working?</b></summary>

1.  **Check default locale**: Ensure your `i18nBoost.defaultLocale` file exists
2.  **Verify key exists**: Make sure the translation key exists in your default locale file
3.  **Check function names**: Ensure the function name matches your configuration
</details>

<details>
 <summary><b>Unused keys not detected?</b></summary>

1.  **Wait for scan**: The extension scans your codebase when files are saved
2.  **Check file patterns**: Ensure your code files match the supported patterns
3.  **Verify function names**: Make sure your translation function calls use the configured function names
</details>

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
