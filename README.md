# i18n-boost

A VS Code extension designed to supercharge your internationalization (i18n) workflow.

i18n-boost integrates directly into your editor to help you **navigate, manage, and use translation keys faster**.  
Whether you're working with `t("...")` or deep JSON locale files, i18n-boost helps you stay productive and avoid errors.

## 🚀 Features

### 1. **Copy Full Translation Key**

Effortlessly copy the full nested key path of any translation value in your locale file.

**How it works:**

- Open your locale file (e.g., `en.json`)
- Right-click on a value
- Select **"Copy Full Translation Key"**
- Paste it anywhere — done!

---

### 2. **Autocomplete for `t("...")`**

Get real-time suggestions for translation keys while typing inside your translation function calls.

**How it works:**

- Start typing `t("` or `t('` in a `.js`, `.ts`, `.vue`, or supported file
- i18n-boost will list all available keys from your locale files
- Suggestions filter automatically as you type

---

### 3. **Ctrl+Click to Jump to Locale**

Navigate directly from a translation key in your code to its definition in your locale file.

**How it works:**

- Hold `Ctrl` (or `Cmd` on Mac) and click a key in `t('...')`
- The editor opens your **default locale file** at the correct line

## 🛠 Installation

### From VS Code Marketplace

_(Coming soon)_

1. Open **Extensions** in VS Code
2. Search for `i18n-boost`
3. Click **Install**

---

### From Source

1. Clone this repository:

   ```bash
   git clone https://github.com/yourusername/i18n-boost.git
   cd i18n-boost
   ```

2. Install dependencies:

   ```
   pnpm install
   ```

3. Compile:

   ```
   pnpm run compile
   ```

4. Press F5 in VS Code to launch the extension in a new Extension Development Host window.

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
│   ├── config.ts              # Config loading
│   ├── commands/              # Command implementations
│   ├── providers/             # Hover, completion, definition providers
```

🤝 Contributing

PRs are welcome!
Please check the [Contributing Guide](CONTRIBUTING.md) for details.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📫 Contact
