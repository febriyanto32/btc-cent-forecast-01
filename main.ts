// btc-cent-forecast-01: guess where Bitcoin trades 240 minutes from now.
//
// Each case hands us 4,320 one-minute closes (three days) ending at its
// checkpoint. We answer with one number: the price we expect at checkpoint
// plus four hours. The program below is plain Node 22 with no dependencies,
// no network and no randomness, so repeated runs agree byte for byte.
//
// The forecast itself is deliberately timid. Four hours out, Bitcoin is
// almost a coin flip around its last print, so we start at that print and
// nudge it only a little: a heavily damped pull in the direction of the
// twelve-hour log trend, plus a small tug back toward the four-hour mean.
// Concretely, with `slope` the per-minute OLS slope of log price across the
// trailing 720 closes and `mean240` the mean of the trailing 240 closes:
//
//   forecast = last * exp(0.15 * slope * 240) + 0.10 * (mean240 - last)
//
// The result is snapped to the price grid (5 decimals) and kept inside
// (0, 10,000,000). For the evidence behind the 0.15 damping and the 0.10
// pull, and the backtest against ~90 alternatives, see README.md.

import * as fs from 'node:fs';
import * as path from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** One grid step: the smallest positive price the scorer's grid allows. */
const FLOOR_PRICE = 0.00001;
/** One step below the scorer's exclusive ten-million-dollar ceiling. */
const CEILING_PRICE = 9_999_999.99999;

type Market = { id: string; prices: number[] };
type CaseFile = { markets: Market[] };

/** Snap a value onto the 5-decimal grid and inside (0, 10,000,000). */
function snapToGrid(value: number): number {
  const clamped = Math.max(FLOOR_PRICE, Math.min(CEILING_PRICE, value));
  return Math.round(clamped * 100000) / 100000;
}

/** Arithmetic mean of the trailing `window` closes (or fewer, if short). */
function recentMean(closes: number[], window: number): number {
  const count = Math.min(window, closes.length);
  let total = 0;
  for (let i = closes.length - count; i < closes.length; i++) total += closes[i] as number;
  return total / count;
}

/** Per-minute OLS slope of log price across the trailing `window` closes. */
function trendSlope(closes: number[], window: number): number {
  const count = Math.min(window, closes.length);
  const first = closes.length - count;
  const logs: number[] = [];
  for (let i = 0; i < count; i++) logs.push(Math.log(closes[first + i] as number));
  let meanLog = 0;
  for (const v of logs) meanLog += v;
  meanLog /= count;
  const mid = (count - 1) / 2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < count; i++) {
    const dx = i - mid;
    num += dx * (logs[i] as number - meanLog);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

/** One market's forecast: damped trend, tugged toward the 4-hour mean. */
function predict(market: Market): number {
  const closes = market.prices;
  if (!Array.isArray(closes) || closes.length === 0) throw new Error(`no prices for market ${market.id}`);
  for (const close of closes) if (!Number.isFinite(close)) throw new Error(`non-finite close in market ${market.id}`);
  const last = closes[closes.length - 1] as number;
  if (!Number.isFinite(last)) throw new Error(`last price of market ${market.id} is not finite`);
  const slope = trendSlope(closes, 720);
  const drifted = last * Math.exp(0.15 * slope * 240);
  const anchored = drifted + 0.1 * (recentMean(closes, 240) - last);
  return snapToGrid(anchored);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
// Case files in name order, so two runs write the same bytes.
const caseFiles = fs.readdirSync(IN_DIR).filter((name) => name.endsWith('.in')).sort();
for (const name of caseFiles) {
  const caseId = name.slice(0, -3);
  const parsed = JSON.parse(fs.readFileSync(path.join(IN_DIR, name), 'utf8')) as CaseFile;
  if (!Array.isArray(parsed.markets) || parsed.markets.length !== 1) throw new Error(`${name} must hold exactly one market`);
  const guess = predict(parsed.markets[0] as Market);
  fs.writeFileSync(path.join(OUT_DIR, `${caseId}.out`), JSON.stringify({ forecasts: [{ case: caseId, price: guess }] }) + '\n');
}
