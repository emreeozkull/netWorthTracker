import type { GoldUnit } from './types';

export const GRAMS_PER_TROY_OUNCE = 31.1034768;

/** Pure gold content in grams for one unit. Turkish coins are 22 carat (0.916). */
export const PURE_GOLD_GRAMS: Record<GoldUnit, number> = {
  gram: 1,
  ounce: GRAMS_PER_TROY_OUNCE,
  ceyrek: 1.75 * 0.916,
  yarim: 3.5 * 0.916,
  tam: 7.0 * 0.916,
  cumhuriyet: 7.216 * 0.916,
};

export function goldUnitPrice(unit: GoldUnit, pricePerPureGram: number): number {
  return PURE_GOLD_GRAMS[unit] * pricePerPureGram;
}
