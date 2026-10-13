# Net Worth

A private, open-source net worth tracker for iOS and Android. There are no servers, accounts, ads or analytics. Everything stays on your phone, encrypted.

- **Track any asset at any institution.** Record stocks, ETFs, funds, cash, gold, crypto, bonds, real estate and debts across your banks, brokers, exchanges and wallets.
- **Broker-invariant view.** Select assets (e.g. AAPL or gram gold) to see the total quantity and value across *all* accounts, with a per-account breakdown.
- **Per-account view.** Open any bank or broker to see everything held there.
- **Multi-currency.** Each asset has its own currency, and totals convert to a base currency you choose (TRY by default).
- **Gold.** Supports gram, troy ounce, and the Turkish coins çeyrek, yarım, tam and cumhuriyet. Coin prices are derived from their pure gold content or entered manually.
- **History.** Records one net worth point per day, with charts by asset type and by account.
- **English and Turkish.**

## Privacy & security

| What | How |
| --- | --- |
| Storage | A single file in the app's private document directory, encrypted with AES-256-GCM |
| Key | 256-bit random key stored in the iOS Keychain / Android Keystore (`expo-secure-store`) |
| App lock | Optional Face ID / fingerprint / device passcode, applied on launch and after leaving the app |
| Backups | Exported files are encrypted with your password (scrypt + AES-256-GCM). The password cannot be recovered |
| Network | **Off by default.** When "Fetch prices online" is enabled, only ticker symbols and currency codes are sent to the providers below, directly from the device. Holdings, amounts and account names are never sent |

Price sources (opt-in):

- [Frankfurter](https://frankfurter.dev): ECB exchange rates.
- Yahoo Finance chart endpoint (unofficial, no key): stocks (including BIST `THYAO.IS`), ETFs, gold futures (`GC=F`), FX fallback.
- [CoinGecko](https://www.coingecko.com): crypto, and the gold spot fallback via PAXG.
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
src/prices/         Opt-in price providers
src/store/          Zustand store (in-memory state, debounced encrypted saves)
src/components/     UI primitives, charts, asset form
src/i18n/           English and Turkish translations, number formatting
```

### Building for the stores

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest build --platform android --profile production
```

Change `ios.bundleIdentifier` and `android.package` in `app.json` to identifiers you own before publishing.

## Contributing

Issues and pull requests are welcome. Please keep the app free of trackers and of any network calls that aren't opt-in.

## License

[MIT](LICENSE)
