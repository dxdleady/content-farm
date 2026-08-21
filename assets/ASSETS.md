# Ассеты — что откуда

Источники:
- Landing — `figma.com/design/yYPrVruUsAxV02W0cy2jts` (node `1:1552`, «mucast-landing-page»)
- Design System — `figma.com/design/DWc917le1Z33MpoWdoXpEW` (node `393:6622`, «UI System»)

## Логотипы
| файл | источник | примечание |
|---|---|---|
| `logos/cast-wordmark.svg` | landing `1:1763` | 6 путей, `fill=currentColor`, viewBox 586×200 |
| `logos/cast-logo.svg` | landing `1:1763` | сырой экспорт Figma (с подложкой) |
| `logos/mubert-badge.svg` | landing `1:1751` | бейдж «by Mubert», градиент внутри |

## Иконки — `icons-clean/` (24-grid, `currentColor`)
`arrow-up-right` `check` `chevron-down` `chevron-up` `close` `dots` `eraser` `file`
`flash` `gem` `music`\* `pause`\* `play` `scissors` `search` `sliders` `sound` `upload`
`users` `zap`

Все, кроме помеченных \*, — точные вектора из Figma (`assets/icons/` = сырые экспорты).
`music` и `pause` дорисованы вручную в той же штриховой манере: в лендинге их не было,
а в сетке дизайн-системы они есть.

## Графика — `images/`
| файл | источник | размер |
|---|---|---|
| `waveform-strip.svg` | landing `1:2114` | 544×96, 208 столбиков |
| `wave-parts-clean.svg` | landing `1:2338` | 522×111 |
| `illustration-episodes-clean.svg` | landing `1:1784` | 579×579 |
| `photo-studio-*.png`, `photo-desk-*.png` | landing `1:1951` | растровые фото из illustration-04 |

## Шрифты — `fonts/`
Inter (300/400/500/600/700) и Playfair Display (400/500/600/700 + italic 400),
woff2, подмножества latin / latin-ext / cyrillic / cyrillic-ext / greek / vietnamese.
Подключаются через `fonts.css`; в рендере инлайнятся в base64, поэтому результат
не зависит от шрифтов, установленных в системе.

## Цвета и типографика
Полный список — `tokens/tokens.json`. Значения цветов и шрифтов взяты из Figma-переменных
дизайн-системы. Стопы градиентов сняты попиксельно со свотчей: Figma отдаёт
gradient-переменные пустыми.
