import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card, Field, Screen, SectionTitle, Txt } from '@/components/ui';
import { goldGramPrice } from '@/domain/valuation';
import { parseDecimal, useFormat } from '@/i18n/format';
import { useAppStore, useData } from '@/store/useAppStore';
import { useColors } from '@/theme';

/** Manual overrides for FX rates and the gold price; shows fetched values for reference. */
export default function RatesScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const data = useData();
  const updateMarket = useAppStore((s) => s.updateMarket);
  const { market, settings } = data;
  const base = settings.baseCurrency;

  const currencies = [
    ...new Set([base, 'TRY', 'EUR', ...data.assets.map((a) => a.currency), ...Object.keys(market.manualRates)]),
  ].filter((c) => c !== 'USD');

  const setManualRate = (currency: string, value: number | undefined) => {
    const manualRates = { ...market.manualRates };
    if (value && value > 0) manualRates[currency] = value;
    else delete manualRates[currency];
    updateMarket({ manualRates });
  };

  const [gram, setGram] = useState(
    market.manualGoldGram ? String(market.manualGoldGram.price) : '',
  );

  const saveGram = () => {
    const price = parseDecimal(gram);
    updateMarket({ manualGoldGram: price && price > 0 ? { price, currency: base } : undefined });
  };

  return (
    <Screen>
      <SectionTitle>{t('rates.fxTitle')}</SectionTitle>
      <Card>
        <Txt variant="small">{t('rates.fxHint')}</Txt>
        {market.ratesUpdatedAt && (
          <Txt variant="small">{t('common.updated', { when: f.dateTime(market.ratesUpdatedAt) })}</Txt>
        )}
        {currencies.map((currency) => (
          <RateRow
            key={currency}
            currency={currency}
            fetched={market.usdRates[currency]}
            manual={market.manualRates[currency]}
            onCommit={(v) => setManualRate(currency, v)}
          />
        ))}
      </Card>

      <SectionTitle>{t('rates.goldTitle')}</SectionTitle>
      <Card style={{ gap: 12 }}>
        {market.goldUsdPerOunce !== undefined && (
          <Txt variant="secondary">
            {t('rates.spot', { price: f.money(market.goldUsdPerOunce, 'USD') })}
            {market.goldUpdatedAt ? ` · ${f.dateTime(market.goldUpdatedAt)}` : ''}
          </Txt>
        )}
        <Field
          label={t('rates.gramPrice', { currency: base })}
          hint={t('rates.gramHint')}
          value={gram}
          onChangeText={setGram}
          onEndEditing={saveGram}
          keyboardType="decimal-pad"
        />
        <Txt variant="muted" tabular>
          {t('rates.current', { price: f.money(goldGramPrice(market, base), base) })}
        </Txt>
      </Card>
    </Screen>
  );
}

function RateRow({
  currency,
  fetched,
  manual,
  onCommit,
}: {
  currency: string;
  fetched?: number;
  manual?: number;
  onCommit: (value: number | undefined) => void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const c = useColors();
  const [text, setText] = useState(manual !== undefined ? String(manual) : '');

  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      <View style={{ flex: 1 }}>
        <Txt>1 USD = … {currency}</Txt>
        <Txt variant="small" tabular>
          {fetched ? t('rates.fetched', { value: f.number(fetched, 4) }) : t('rates.notSet')}
        </Txt>
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => onCommit(parseDecimal(text))}
        placeholder={fetched ? f.number(fetched, 4) : '—'}
        placeholderTextColor={c.muted}
        keyboardType="decimal-pad"
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { width: 120, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, textAlign: 'right' },
});
