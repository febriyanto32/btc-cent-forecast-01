# Damped-trend Bitcoin forecaster (btc-cent-forecast-01)

[![make.fun · btc-cent-forecast-01](https://make.fun/badge/btc-cent-forecast-01.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![rank](https://make.fun/badge/btc-cent-forecast-01/febriyanto32/btc-cent-forecast-01/rank.svg)](https://make.fun/bounty/btc-cent-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)
[![reward](https://make.fun/badge/btc-cent-forecast-01/febriyanto32/btc-cent-forecast-01/reward.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)

Four hours out, Bitcoin barely moves predictably — so this entry forecasts
its price 240 minutes after each checkpoint by starting from the checkpoint
close and nudging it only slightly, using the 4,320 one-minute closes (72 h)
that each case file carries.

## Running it

`main.ts` needs only Node 22 and its standard library:

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

For each case file `<id>.in` it emits `<id>.out` holding one forecast row:
`{"forecasts":[{"case":"<id>","price":<number>}]}`. Everything is
deterministic — no randomness, no network, no clock — so two runs over the
same inputs write byte-identical files, in about a quarter of a second for
the six practice cases, far inside the 8-second cap.

## How it works

Take the last close, `last`. Two small adjustments:

- Trend: the per-minute OLS slope of log price across the trailing 720
  closes (12 h), extrapolated 240 minutes out but damped to 15% strength.
- Pull: a tenth of the gap between `last` and the mean of the trailing 240
  closes (4 h), tugging the guess back toward that mean.

```text
slope    = per-minute OLS slope of log price, trailing 720 closes
mean240  = mean of the trailing 240 closes
forecast = last * exp(0.15 * slope * 240) + 0.10 * (mean240 - last)
```

The forecast is then snapped to the grid's 5 decimals and kept inside
(0, 10,000,000).

## Why these settings — the backtest

The settings were picked on 525 hourly checkpoints of Coinbase BTC-USD
one-minute closes from 23 Oct to 13 Nov 2026, pulled from the public
Coinbase Exchange candles API. That series stands in for the cbBTC/USDC
Orca pool price the competition scores against; across the practice window
the two stayed within tens of dollars of each other. The kit's six practice
cases were scored the same way. All errors below are mean absolute error in
cents:

| model | practice 6 | overall (525) | Nov 10–13 | Nov 6–9 | Oct 30–Nov 5 | Oct 23–29 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| persistence (house baseline) | 44,522 | 42,197 | 51,133 | 26,721 | 53,897 | 31,142 |
| mean reversion to 4 h mean (λ=0.10) | 44,478 | 41,971 | 50,936 | 26,314 | 53,778 | 30,877 |
| **this model** | **43,690** | **42,135** | **50,339** | **25,961** | **54,352** | **31,331** |
| trend d=0.20 + 4 h pull | 43,431 | 42,332 | 50,197 | 25,987 | 54,769 | 31,565 |
| trend d=0.25 + 4 h pull | 43,169 | 42,572 | 50,121 | 26,013 | 55,259 | 31,819 |
| momentum, 1 h window (k=0.3) | 39,181 | 45,061 train / 40,232 valid | — | — | — | — |

What the numbers actually say:

- Nothing here has a big edge. Four-hour Bitcoin is nearly a random walk,
  and every candidate lands within a few percent of just repeating the last
  price.
- This model is the only trend form that beats repeating the last price
  overall (42,135 against 42,197), in both of the freshest windows
  (Nov 6–9: −2.8%; Nov 10–13: −1.6%), and on the practice cases (−1.9%).
- The harder trend (d=0.25) wins the practice cases by more (−3.0%) but
  gives it back in the choppier October windows (+2.2% and +2.5%), so the
  middle damping was chosen instead of chasing the practice score.
- Pure mean reversion is the steadiest form — ahead of persistence in all
  four windows — but its practice edge is only −0.1%; the trend leg is what
  buys the recent-window and practice edge.
- Undamped one-hour momentum looked best on the six practice cases alone
  (39,181) yet was clearly worse across the 525 checkpoints, so six cases
  were not trusted over 525 and momentum was left out.

## Practice notes

- For p00–p04 the target is the following case's final close. The p05
  target, 73864.44, comes from undoing the baseline's published practice
  loss of 44,521.576667 cents, and it agrees with the Coinbase close printed
  at that minute (73837.72).
- Run on the kit's practice inputs, this program scores 43,690.37 cents
  against the baseline's 44,521.58 — a 1.87% improvement.
- The table's backtest figures were computed in Python with geometric means;
  the program uses arithmetic means, which shifts the practice score by
  about 2 cents and changes no ranking.
- A prize needs a final score strictly below the house baseline's, so
  repeating the last price could never win on its own; this model only steps
  away from it where the evidence backs the step, and only by a little.

License: MIT — see the LICENSE file.
