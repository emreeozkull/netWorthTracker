# Net Worth

A private, open-source net worth tracker for iOS and Android. There are no servers, accounts, ads or analytics. Everything stays on your phone, encrypted.

- **Track any asset at any institution.** Record stocks, ETFs, funds, cash, gold, crypto, bonds, real estate and debts across your banks, brokers, exchanges and wallets.
- **Broker-invariant view.** Select assets (e.g. AAPL or gram gold) to see the total quantity and value across *all* accounts, with a per-account breakdown.
- **Per-account view.** Open any bank or broker to see everything held there.
- **Multi-currency.** Each asset has its own currency, and totals convert to a base currency you choose (TRY by default).
- **Gold.** Supports gram, troy ounce, and the Turkish coins çeyrek, yarım, tam and cumhuriyet. Coin prices are derived from their pure gold content or entered manually.
- **History.** Takes a snapshot of every account and holding on each day you use the app. The History tab charts net worth or any single account over time; tap a day to see what you held in each account, its value, and what changed since the previous snapshot (shares bought or sold, new and closed positions). Each snapshot keeps that day's prices, exchange rates and names, so history survives renames, deletions and base-currency changes.
- **English and Turkish.**

## Privacy & security

| What | How |
| --- | --- |
| Storage | A single file in the app's private document directory, encrypted with AES-256-GCM |
| Key | 256-bit random key stored in the iOS Keychain / Android Keystore (`expo-secure-store`) |
| App lock | Optional Face ID / fingerprint / device passcode, applied on launch and after leaving the app |
| Backups | Exported files are encrypted with your password (scrypt + AES-256-GCM). The password cannot be recovered |
| Network | "Fetch prices online" is **on by default** for new installs and can be turned off in Settings for a fully offline app. When on, prices refresh once a day (on launch or when the app returns to the foreground) and when you add an asset; only ticker symbols, currency codes and what you type into asset search are sent to the providers below, directly from the device. Holdings, amounts and account names are never sent |

Price sources (used only while "Fetch prices online" is on):

- [Frankfurter](https://frankfurter.dev): ECB exchange rates.
- Yahoo Finance chart and search endpoints (unofficial, no key): stocks (including BIST `THYAO.IS`), ETFs, funds, gold futures (`GC=F`), FX fallback, and symbol suggestions while you type an asset name.
- [CoinGecko](https://www.coingecko.com): crypto prices and crypto symbol search, and the gold spot fallback via PAXG.
- [Finnhub](https://finnhub.io): optional fallback for US stocks, using your own API key.

When fetching is off, you enter unit prices, FX rates and the gram gold price yourself (Settings → Exchange rates & gold).

## Development

Requirements: Node 20+ and npm. For device testing you need the Expo Go app or a development build.

```bash
npm install
npm start            # then press i (iOS simulator), a (Android) or scan the QR code with Expo Go
npm test             # unit tests (valuation, aggregation, gold, crypto, backups)
npm run typecheck
npm run lint
```

Face ID can't be tested in Expo Go on iOS. Use a development build (`npx expo run:ios` or `eas build --profile development`).

### Project layout

```
src/app/            Screens (expo-router): tabs, account detail, edit modals, rates, backup
src/domain/         Pure logic: types, valuation, aggregation, gold, snapshots, schema
src/storage/        Encryption, encrypted repository, backups, app lock
src/prices/         Price providers, symbol search, daily refresh check
src/store/          Zustand store (in-memory state, debounced encrypted saves)
src/components/     UI primitives, charts, asset form
src/i18n/           English and Turkish translations, number formatting
```

### Building for the stores

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

Your own identifiers are kept out of the repository. Copy `.env.example` to `.env.local` (gitignored) and set:

- `APP_BUNDLE_ID`: an iOS bundle identifier / Android package name you own, e.g. `com.yourname.networth`
- `EAS_PROJECT_ID`: your EAS project ID (from `npx eas-cli@latest init` or expo.dev)

`app.config.ts` reads them for both `expo` and `eas` commands. Without them, the placeholder `io.github.networth.app` from `app.json` is used. For builds on EAS servers, also define both as [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), because `.env.local` isn't uploaded.

## Contributing

Issues and pull requests are welcome. Please keep the app free of trackers and of any network calls that aren't opt-in.

## License

[MIT](LICENSE)
