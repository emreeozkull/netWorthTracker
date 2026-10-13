import { localDateKey } from './snapshot';
import { emptyData, type AppData } from './types';

/** Sample portfolio for exploring the app. Prices and rates are illustrative, not live. */
export function demoData(settings = emptyData().settings): AppData {
  const data = emptyData();
  data.settings = settings;
  data.market.manualRates = { TRY: 41.5, EUR: 0.86 };
  data.market.goldUsdPerOunce = 4000;
  data.market.goldUpdatedAt = Date.now();

  data.institutions = [
    { id: 'demo-bank', name: 'Demo Bank', type: 'bank', color: '#2563EB' },
    { id: 'demo-broker-a', name: 'Broker A', type: 'broker', color: '#10B981' },
    { id: 'demo-broker-b', name: 'Broker B', type: 'broker', color: '#F59E0B' },
    { id: 'demo-exchange', name: 'Crypto Exchange', type: 'exchange', color: '#8B5CF6' },
  ];

  data.assets = [
    { id: 'demo-try', kind: 'cash', name: 'Turkish Lira', currency: 'TRY', priceMode: 'manual' },
    { id: 'demo-usd', kind: 'cash', name: 'US Dollar', currency: 'USD', priceMode: 'manual' },
    { id: 'demo-aapl', kind: 'stock', name: 'Apple', symbol: 'AAPL', currency: 'USD', priceMode: 'auto', manualPrice: 230 },
    { id: 'demo-thyao', kind: 'stock', name: 'Türk Hava Yolları', symbol: 'THYAO.IS', currency: 'TRY', priceMode: 'auto', manualPrice: 300 },
    { id: 'demo-gram', kind: 'gold', name: 'Gram Altın', currency: 'TRY', goldUnit: 'gram', priceMode: 'derivedGold' },
    { id: 'demo-ceyrek', kind: 'gold', name: 'Çeyrek Altın', currency: 'TRY', goldUnit: 'ceyrek', priceMode: 'derivedGold' },
    { id: 'demo-btc', kind: 'crypto', name: 'Bitcoin', symbol: 'BTC', currency: 'USD', priceMode: 'auto', manualPrice: 100000 },
    { id: 'demo-card', kind: 'debt', name: 'Credit card', currency: 'TRY', priceMode: 'manual' },
  ];

  data.holdings = [
    { id: 'demo-h1', institutionId: 'demo-bank', assetId: 'demo-try', quantity: 150000 },
    { id: 'demo-h2', institutionId: 'demo-bank', assetId: 'demo-usd', quantity: 5000 },
    { id: 'demo-h3', institutionId: 'demo-bank', assetId: 'demo-gram', quantity: 50 },
    { id: 'demo-h4', institutionId: 'demo-bank', assetId: 'demo-card', quantity: 12000 },
    { id: 'demo-h5', institutionId: 'demo-broker-a', assetId: 'demo-aapl', quantity: 10, avgCost: 180 },
    { id: 'demo-h6', institutionId: 'demo-broker-b', assetId: 'demo-aapl', quantity: 5, avgCost: 210 },
    { id: 'demo-h7', institutionId: 'demo-broker-b', assetId: 'demo-thyao', quantity: 400 },
    { id: 'demo-h8', institutionId: 'demo-broker-a', assetId: 'demo-gram', quantity: 20 },
    { id: 'demo-h9', institutionId: 'demo-exchange', assetId: 'demo-btc', quantity: 0.15 },
    { id: 'demo-h10', institutionId: 'demo-bank', assetId: 'demo-ceyrek', quantity: 4 },
  ];

  // A short synthetic history so the chart has something to show.
  const today = new Date();
  for (let i = 30; i >= 1; i -= 5) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const usd = 62000 + (30 - i) * 180;
    data.snapshots.push({ date: localDateKey(d), values: { USD: usd, TRY: usd * 41.5, EUR: usd * 0.86 } });
  }
  return data;
}
