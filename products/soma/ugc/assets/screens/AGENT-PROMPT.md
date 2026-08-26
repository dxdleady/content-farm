# Промпт для агента внутри `~/soma-final`

Скопировать всё, что ниже разделителя, и отдать агенту, запущенному в папке приложения.

---

Ты работаешь в `~/soma-final` (iOS-приложение SOMA). Задача: **отснять набор маркетинговых
скриншотов** для TikTok-слайдшоу и положить готовые файлы в соседний репозиторий.

## Что уже сделано за тебя

В `/Users/mary_shabash/content-farm-source/products/soma/ugc/assets/screens/` лежат:

- `MarketingScreenshotUITests.swift` — готовый XCUITest, снимающий ~60 кадров шестью
  методами. Он намеренно ничего не ассертит: до чего не дошёл — залогировал и пропустил.
- `SHOTLIST.md` — что именно нужно, с приоритетами и объяснением, зачем каждый кадр.

Прочитай `SHOTLIST.md` целиком перед началом — там сказано, какие кадры критичны (P1) и
почему, и это меняет, на что тратить время при поломках.

Начни с `cp /Users/mary_shabash/content-farm-source/products/soma/ugc/assets/screens/MarketingScreenshotUITests.swift UITests/`

## Как запускать — важно, тут есть грабли

Симулятор прибит гвоздями: `platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5`.

**Никогда не запускай все методы одной командой `xcodebuild`.** В `scripts/test.sh` есть
явный комментарий: прогон 14 UI-тестов в одном вызове стабильно роняет SpringBoard на
машине с 16 ГБ, после чего приложение получает SIGKILL и **перезапускается уже без
launch-аргументов** — фикстуры не применяются, а тест продолжает «успешно» снимать
пустое незалогиненное приложение. Скриншоты при этом выглядят правдоподобно и молча
врут. Поэтому:

```bash
xcodebuild build-for-testing -project Soma.xcodeproj -scheme SomaUITests \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -quiet

# дальше — по одному методу за вызов, с одним ретраем при падении
for t in test_shots_01_onboardingSurvey test_shots_02_onboardingScreens \
         test_shots_03_homeStates test_shots_04_workout \
         test_shots_05_nutrition test_shots_06_scanProgressAndSettings; do
  xcodebuild test-without-building -project Soma.xcodeproj -scheme SomaUITests \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
    -only-testing:"SomaUITests/MarketingScreenshotUITests/$t" \
    -resultBundlePath "/tmp/soma-shots-$t.xcresult"
done
```

`test_shots_03_homeStates` сам по себе поднимает приложение 14 раз — если он окажется
нестабильным, разрежь его на два метода и запусти отдельно, это нормальное решение.

## Часы в статус-баре

Перед прогоном можно выставить время:

```bash
xcrun simctl status_bar booted override --time "06:45" \
  --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
```

Хорошо бы утренние кадры снять на `06:45`, тренировку на `09:10`, питание на `13:20`,
ужин и рецепт на `19:30`, дашборд на `22:15`. **Но это приятный бонус, а не блокер.**
Если `simctl status_bar` не срабатывает на этой версии симулятора — не трать на это
время, сними как есть и напиши в отчёте, что часы не переопределились: время всё равно
крупно написано на самих слайдах, статус-бар только не должен явно противоречить.

## Как достать файлы

Скриншоты лежат в `.xcresult` как XCTAttachment:

```bash
brew install chargepoint/xcparse/xcparse    # один раз
xcparse screenshots /tmp/soma-shots-<test>.xcresult /tmp/soma-shots-out
```

Если `xcparse` не ставится — вытащи через `xcrun xcresulttool get --legacy --format json
--path <bundle>` и последующий `xcresulttool export`. Не застревай: любой способ, лишь бы
получить PNG.

## Куда класть результат

Готовые PNG — в `/Users/mary_shabash/content-farm-source/products/soma/ugc/assets/screens/`,
имена по схеме `screen-<область>-<состояние>.png`, строчными, без пробелов:

```
screen-home-morning.png     screen-home-restday.png      screen-why-expanded.png
screen-sleep-oura.png       screen-sleep-empty.png       screen-nutrition-morning.png
screen-recipe-result.png    screen-cook-step.png         screen-workout-complete.png
screen-eta-slipped.png      screen-survey-goal.png       screen-connect-devices.png
screen-plan-generating.png  screen-streak.png            screen-dashboard-sleep.png
```

Имена внутри теста (`home-restday-top` и т.п.) — рабочие; переименуй при раскладке по
смыслу, ориентируясь на таблицу в `SHOTLIST.md`. Ничего в `content-farm-source` кроме
этой папки не трогай и коммитить там не нужно.

## Обязательно: посмотри на каждый кадр глазами

Это не формальность, а единственная защита от тихой поломки выше. Открой каждый PNG и
проверь:

1. **Это фикстурные данные, а не пустое приложение.** На главном экране должны быть
   реальные значения — план на день, стрик-плашка, недельная полоса. Экран приветствия
   «Find your next best day» вместо главного означает, что фикстуры не применились и
   прогон надо повторить.
2. **Состояние то самое.** `home-restday` должен показывать день отдыха, а не обычную
   тренировку. `home-sleep-oura` — виджет сна с источником Oura, а не пустые чипы
   «How long last night?». Если состояние не то — скажи об этом, не подкладывай похожий кадр.
3. **Нет плейсхолдеров и отладочного мусора** — «Lorem», нули, пустые списки, тестовые
   почты вида `test@`.
4. **Английский язык, светлая тема.** Приложение принудительно светлое, тёмной темы нет.

## Если что-то не снялось

Тест логирует пропуски строками `… no button 'X' — skipping that shot`. Собери такие
строки и приложи к отчёту: скорее всего у кнопки другой label или accessibility id.
Можешь поправить селектор в тесте (он у тебя локально в `UITests/`) и переснять, если
это дёшево. **Не переписывай приложение ради скриншота** — если экран недостижим, так и
напиши.

Отдельно: если какое-то состояние вообще не достаётся через XCUITest, в репозитории есть
второй путь — SwiftUI-снапшоты (`scripts/test.sh snapshot`, они рендерят вью напрямую,
393pt @2x, уже покрыт 21 экран на 9 языках). У них нет статус-бара вовсе, поэтому это
запасной вариант, а не основной. Референсные PNG машинно-локальные и в `.gitignore` —
на свежем чекауте сначала `scripts/test.sh snapshot --record`.

## Что вернуть в конце

Короткий отчёт:

- сколько кадров снято и где они лежат;
- список из `SHOTLIST.md`, который снять **не** удалось, и почему (недостижимый экран /
  сломанный селектор / состояние не воспроизводится);
- получилось ли переопределить часы;
- всё, что ты заметил по дороге и что стоит знать маркетингу: экраны, которых в
  приложении нет, состояния, выглядящие пусто или неубедительно, тексты, обещающие то,
  чего продукт не делает.

Последний пункт важен не меньше самих файлов: пост, построенный вокруг экрана, которого
нет, дороже отсутствующего поста.
