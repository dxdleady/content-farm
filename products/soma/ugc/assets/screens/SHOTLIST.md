# App screenshots — the shot list

What the routine series needs from the app, why, and exactly how to capture it.
Run `MarketingScreenshotUITests.swift` (in this folder) and most of it comes out in one go.

## Why this exists

The seven screens we have now came from the marketing site's renders, not from the app.
They were shot at whatever moment the render happened, so `screen-home.png` says
**19:15 · "Good afternoon"** — and it is currently sitting on a slide that reads *6:45*.
That single detail is what makes a routine post read as staged. Everything below is
either a state we cannot show at all today, or the same state shot at the right minute.

## How to capture

Two paths exist in the app repo. **Use the XCUITest one** — it runs the real app, so the
screenshot has a real device frame and a status bar we can set.

```bash
cp MarketingScreenshotUITests.swift ~/soma-final/UITests/
cd ~/soma-final
xcrun simctl boot "iPhone 17 Pro" || true
xcrun simctl status_bar booted override --time "06:45" \
    --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
xcodebuild test -project Soma.xcodeproj -scheme SomaUITests \
    -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
    -only-testing:SomaUITests/MarketingScreenshotUITests \
    -resultBundlePath /tmp/soma-shots.xcresult
brew install chargepoint/xcparse/xcparse   # once
xcparse screenshots /tmp/soma-shots.xcresult ~/Desktop/soma-shots
```

Then hand the folder over, or drop the files straight into this directory.

**The clock is the whole point.** `simctl status_bar override --time` is one command and
nothing in the repo used it before. Re-run it between groups so each screen carries the
minute its slide claims:

| moment | clock | what to shoot in that pass |
|---|---|---|
| waking | `06:45` | home (all readiness states), sleep widget |
| training | `09:10` | workout detail, plan blocks, completed |
| lunch | `13:20` | nutrition, log meal, gym scan |
| dinner | `19:30` | fridge recipe, cook mode |
| night | `22:15` | dashboard, progress, tomorrow |

The other path — the SwiftUI snapshot suite (`scripts/test.sh snapshot`) — renders views
directly at 393pt @2x with **no status bar at all**. Faster and already covers 21 screens
in 9 languages, but a screen with no status bar reads as a mockup rather than as her
phone. Use it only as a fallback for a screen the UI test cannot reach.

Everything is **English, light mode, iPhone 17 Pro**. The app has no dark mode.

## What to shoot

Priority 1 is what the eight routine posts are blocked on. Priority 2 unlocks the next
wave (the full-journey series sketched at the bottom). Priority 3 is nice to have.

### P1 — the daily loop, at the right minute

| # | shot | fixture | why we need it |
|---|---|---|---|
| 1 | `home-moderate-top` at **06:45** | `UITEST_SCENARIO=activeGoalWeek2` `UITEST_SLEEP_SOURCE=healthkit` | the morning card. Replaces the 19:15 "Good afternoon" we ship today |
| 2 | `home-restday-top` at **06:45** | `UITEST_SCENARIO=activeGoalDay28Rest` | **the most important screen in the wave.** The plan backing off is the mechanism; every other claim is a promise |
| 3 | `workout-03-why-expanded` | `activeGoalWeek2`, tap "Why this?" | the app's whole argument, and it is invisible in every asset we own |
| 4 | `home-sleep-oura` / `-whoop` | + `UITEST_SLEEP_SOURCE=oura` \| `whoop` | proves "reads your wearables" instead of asserting it |
| 5 | `home-sleep-empty` | `activeGoalWeek2`, no sleep source | the "How long last night?" chips — the honest day-1 state |
| 6 | `home-moderate-widgets` | as #1, scrolled | water · sleep · streak · nutrition · affirmation in one frame |
| 7 | evening / tomorrow view at **22:15** | dashboard → Sleep section | there is no sleep or wind-down screen in the app's own assets. If a dedicated one does not exist, the dashboard Sleep section is the substitute |

### P2 — the full journey, for the next series

| group | shots | fixture |
|---|---|---|
| **Setup** | `survey-01-sex` … `survey-22-celebration` — all 22 questions | `UITEST_ONBOARDING_SURVEY_STEP=<case>` |
| | `onboarding-01-welcome` | `--ui-test-onboarding-demo` |
| | connect devices · notifications | same run |
| | `postsetup-loading` (the % ring), `-planSummary`, `-bodyPhotos`, `-tryFree` | `UITEST_POSTSETUP=<step>` |
| **Workout** | detail top · plan blocks · exercise detail · **completed workout** (the payoff screen) | `activeGoalWeek2` |
| **Food** | targets · logged meals · log-a-meal · **fridge recipe** · **cook mode** | + `UITEST_NUTRITION_STATE=perfect` |
| **Gym scan** | pick photo · analysing · detected equipment · generated plan | dock "Scan gym" |
| **Progress** | goal-vs-current slider · dashboard overview · sleep stages · metric drill-down | dock "Dashboard" |
| **Goals** | sport list · target reveal · goal hub week 2 · **ETA slipped** | `activeGoalWeek4Slipped` |
| **Streak** | streak tile with a streak · streak share card | `activeGoalWeek2` |

`activeGoalWeek4Slipped` deserves its own note: the fixture is "week 4, ETA slipped +9
days, 2 missed sessions + 3 low-readiness days". A post that admits the plan slipped and
shows the app saying so is worth more than five posts claiming it never does.

### P3 — texture

Edit widgets · More actions · affirmations · how-Soma-works tour · history calendar with
crowns · day detail · profile with the streak section · trial banner · paid state.

## Naming

`screen-<area>-<state>.png`, lower case, no spaces:

```
screen-home-morning.png        screen-home-restday.png       screen-why-expanded.png
screen-sleep-oura.png          screen-nutrition-morning.png  screen-recipe-result.png
screen-cook-step.png           screen-workout-complete.png   screen-eta-slipped.png
screen-survey-goal.png         screen-connect-devices.png    screen-plan-generating.png
```

Drop them in this folder. Decks reference them by path, so swapping a placeholder for the
real thing is a one-line edit and a ten-second re-render.

## What each unblocks

Right now `deck-routine-day`, `-morning`, `-badnight`, `-busy` and `-sunday` each carry a
phone-in-scene slide pointing at `screen-home.png`. P1 replaces those. P2 unlocks a
seven-post full-journey series that does not exist yet:

| planned deck | needs |
|---|---|
| `journey-setup` — download to first plan | survey shots, connect devices, plan generating, plan summary |
| `journey-firstweek` — day 1 to day 7 | day-1 baseline home, streak tile, history calendar |
| `journey-workout` — card to completed | workout detail, why expanded, plan blocks, completed |
| `journey-food` — targets to cook mode | nutrition, log meal, fridge recipe, cook mode |
| `journey-scan` — a photo of the gym to a plan | the four gym-scan states |
| `journey-progress` — what changed | goal-vs-current, dashboard, metric detail |
| `journey-slips` — when the week goes wrong | rest day, ETA slipped, re-plan |

## Custom goal ("Your own plan") shots — captured 2026-08-31

Group 14 in `MarketingScreenshotUITests.swift` (fixtures `customCoachFlow`,
`customGoalWeek2`, `customGoalItemized`). Staged as:

| file | shows | note |
|---|---|---|
| `screen-goal-form-filled.png` | the form with a typed plan, coach "Elena", schedule 8w/3× | the chips row is deliberately absent (free text matches no program) — never ship a frame with the curated program names, they are not cleared for marketing |
| `screen-goal-form-schedule.png` | form bottom: schedule, "Track a measurable", Start the block + the honest footnote | |
| `screen-goal-form-ruler.png` | measurable on: Approach jump / cm / baseline ruler | |
| `screen-goal-conflict.png` | the amber safety warning ("depth jumps … injury you've noted") | driven by the "depth jump" sentinel in UITestSupport's create-goal stub |
| `screen-goal-hub-custom.png` | Goal hub: COACH ALEX, phases, re-check date, Sessions 3 of 16, Share | hub fits one screen — no "-lower" variant exists |
| `screen-goal-coach-block.png` | daily plan with COACH BLOCK — BUILT WITH ALEX, "as written by your coach" rows | |
| `screen-goal-home-custom.png` | Home with "Coach Alex's task · week 2 of 8" under the day card | |

All post-creation surfaces carry "Coach Alex" — fine for coach-story decks,
contradicts self-plan stories (5x5/5K decks use form/calendar shots instead).
