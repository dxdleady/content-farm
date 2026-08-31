import XCTest

/// Marketing screenshot capture — every screen the TikTok routine series needs,
/// in one run, from the real app with a real device frame.
///
/// This is NOT a regression test: nothing here asserts. A screen that cannot be
/// reached is skipped and logged, never failed, so one bad selector never costs
/// you the other sixty shots.
///
///   cp MarketingScreenshotUITests.swift ~/soma-final/UITests/
///   cd ~/soma-final
///   xcrun simctl boot "iPhone 17 Pro" || true
///   xcrun simctl status_bar booted override --time "06:45" \
///       --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
///   xcodebuild test -project Soma.xcodeproj -scheme SomaUITests \
///       -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
///       -only-testing:SomaUITests/MarketingScreenshotUITests \
///       -resultBundlePath /tmp/soma-shots.xcresult
///   xcparse screenshots /tmp/soma-shots.xcresult ~/Desktop/soma-shots
///       # brew install chargepoint/xcparse/xcparse
///
/// The status-bar override is the point of running through XCUITest rather than
/// the SwiftUI snapshot suite: a slide that says 6:45 must not carry a 19:15
/// clock. Re-run `status_bar override --time` between groups to match the moment
/// (morning 06:45 · training 09:10 · lunch 13:20 · dinner 19:30 · night 22:15).
///
/// Fixture knobs, all from Soma/Services/UITestSupport.swift:
///   UITEST_SCENARIO            10 FixtureScenario cases
///   UITEST_SLEEP_SOURCE        oura | whoop | healthkit
///   UITEST_NUTRITION_STATE     perfect | over | under
///   UITEST_SUBSCRIPTION        trial | premium_monthly | premium_annual | free
///   UITEST_ONBOARDING_SURVEY_STEP   a SurveyStep case name
///   UITEST_DETECTED_WORKOUT=1  seeds a device-detected session
final class MarketingScreenshotUITests: XCTestCase {

    private var runningApp: XCUIApplication?

    override func setUp() {
        continueAfterFailure = true
    }

    override func tearDown() {
        runningApp?.terminate()
        runningApp = nil
    }

    // MARK: - Plumbing

    private let homeAnchors = ["Lower body strength", "Moderate", "Rest", "Push Hard", "Light Movement"]

    /// Every launch gets two defaults a case can override:
    ///
    /// - `UITEST_CLOCK_HOUR` -- `simctl status_bar --time` repaints the
    ///   status bar only, so without this a 06:45 bar carries a "Good
    ///   afternoon" greeting: the exact staged-looking contradiction these
    ///   shots exist to remove.
    /// - `UITEST_SUBSCRIPTION=premium_annual` -- the fixture's default
    ///   `referral_bonus_until: 2099-01-01` renders as a "26,426 DAYS"
    ///   gold plaque, which reads as debug garbage in a marketing frame.
    ///   A paid entitlement shows "PRO" instead.
    private func launch(_ env: [String: String], args: [String] = ["--ui-test-fixtures"]) -> XCUIApplication {
        runningApp?.terminate()
        let app = XCUIApplication()
        app.launchArguments = args
        app.launchEnvironment["UITEST_CLOCK_HOUR"] = "6"
        app.launchEnvironment["UITEST_SUBSCRIPTION"] = "premium_annual"
        for (k, v) in env { app.launchEnvironment[k] = v }
        app.launch()
        runningApp = app
        return app
    }

    private func shoot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    /// Waits until ANY of `anchors` is on screen, polling so the whole budget is
    /// shared rather than spent per label. Shoots regardless — a renamed label
    /// costs a warning in the log, not the picture.
    private func settle(_ app: XCUIApplication, anchors: [String], timeout: TimeInterval = 15) {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if anchors.contains(where: { app.staticTexts[$0].exists }) { return }
            usleep(300_000)
        }
        print("… none of \(anchors) appeared in \(Int(timeout))s; shooting whatever is on screen")
    }

    /// Taps whatever carries `label`, preferring a HITTABLE match.
    ///
    /// `firstMatch` is the trap here: Home stays in the hierarchy behind a
    /// presented sheet, so `buttons["Why this?"]` resolved to Home's own
    /// disclosure, found it unhittable, and coordinate-tapped through to
    /// nothing -- leaving a shot identical to the one before it. Same
    /// story for "Edit widgets". So: collect every candidate, tap the
    /// first hittable one, and only fall back to a coordinate tap when
    /// nothing on screen is hittable at all.
    @discardableResult
    private func tapIfPresent(_ app: XCUIApplication, _ label: String, timeout: TimeInterval = 6) -> Bool {
        func candidates() -> [XCUIElement] {
            let queries = [
                app.buttons.matching(NSPredicate(format: "identifier == %@", label)),
                app.buttons.matching(NSPredicate(format: "label == %@", label)),
                app.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)),
                app.staticTexts.matching(NSPredicate(format: "label == %@", label)),
            ]
            return queries.flatMap { $0.allElementsBoundByIndex }
        }
        let deadline = Date().addingTimeInterval(timeout)
        var lastResort: XCUIElement?
        while Date() < deadline {
            let found = candidates()
            if let hittable = found.first(where: { $0.exists && $0.isHittable }) {
                hittable.tap()
                return true
            }
            lastResort = lastResort ?? found.first(where: { $0.exists })
            usleep(300_000)
        }
        if let element = lastResort, element.exists, element.frame.width > 0, element.frame.height > 0 {
            print("… '\(label)' never became hittable — tapping its centre")
            element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            return true
        }
        print("… no button '\(label)' — skipping that shot")
        return false
    }

    /// The "Why this?" disclosure on the workout detail reports an
    /// accessibility frame ~220 pt BELOW where it actually draws, so
    /// XCUITest calls it unhittable and a tap on its reported centre lands
    /// on the card underneath. (Worth a bug of its own: VoiceOver has the
    /// same wrong target.) Sweep the window where it visually is instead,
    /// and let the trigger's own open-state label confirm the hit.
    private func openWhyThis(_ app: XCUIApplication) -> Bool {
        if let hittable = app.buttons.matching(NSPredicate(format: "label == 'Why this?'"))
            .allElementsBoundByIndex.first(where: { $0.exists && $0.isHittable }) {
            hittable.tap()
            if app.buttons["Hide details"].waitForExistence(timeout: 3) { return true }
        }
        print("… 'Why this?' on the workout detail took no tap — see the report")
        return false
    }

    // MARK: - 1. Setup: the 22-step survey, one launch per question

    func test_shots_01_onboardingSurvey() {
        let steps = [
            "sex", "workoutFrequency", "dateOfBirth", "referralSource", "trustChart",
            "currentWeight", "heightEntry", "personalTrainer", "goal", "desiredWeight",
            "weightDeltaReaction", "goalPace", "comparisonBar", "journeyStage", "blockers",
            "blockersNotes", "anchorSession", "dietType", "kitchenEquipment", "accomplishment",
            "onTrack", "celebration",
        ]
        for (i, step) in steps.enumerated() {
            let app = launch(["UITEST_ONBOARDING_SURVEY_STEP": step])
            _ = app.scrollViews.firstMatch.waitForExistence(timeout: 12)
            shoot(app, String(format: "survey-%02d-%@", i + 1, step))
        }
    }

    // MARK: - 2. Setup: welcome, devices, notifications, paywall run-up

    func test_shots_02_onboardingScreens() {
        let welcome = launch([:], args: ["--ui-test-onboarding-demo"])
        settle(welcome, anchors: ["Find your next best day"])
        shoot(welcome, "onboarding-01-welcome")

        for step in ["loading", "consent", "planSummary", "bodyPhotos", "tryFree", "trialReminder"] {
            let app = launch(["UITEST_POSTSETUP": step], args: ["--ui-test-onboarding-demo-resume"])
            _ = app.otherElements.firstMatch.waitForExistence(timeout: 12)
            sleep(2)
            shoot(app, "postsetup-\(step)")
        }

    }

    /// Superwall is remote and needs the real network AND an unentitled
    /// user: the onboarding_paywall campaign's audience is "unsubscribed
    /// users", so launch()'s premium_annual default makes the SDK skip
    /// presentation and run the feature closure straight through to Home.
    ///
    /// Even with `free` this often will not present, because the campaign
    /// also carries an occurrence limit and the fixture user id is a
    /// constant -- once any run on this machine has seen it, later runs
    /// are skipped by design. The repo's own
    /// `OnboardingPaywallMatrixUITests/test_paywall_free` captures the
    /// same screen and is where the shipped shot came from; run that on a
    /// user who has not seen it rather than retrying this.
    func test_shots_13_paywall() {
        let app = launch([
            "UITEST_POSTSETUP": "paywall",
            "UITEST_SUBSCRIPTION": "free",
            "UITEST_NO_REFERRAL_BONUS": "1",
        ], args: ["--ui-test-onboarding-demo-resume"])
        if app.buttons["Restore"].waitForExistence(timeout: 30) {
            sleep(3)
            shoot(app, "postsetup-paywall")
        } else {
            print("… Superwall never presented — no network, or the campaign is paused")
            shoot(app, "postsetup-paywall-missing")
        }
    }

    // MARK: - 3. The daily home, every state that changes what it says

    private func shootHome(_ cases: [(name: String, env: [String: String])]) {
        for c in cases {
            let app = launch(c.env)
            settle(app, anchors: ["Lower body strength", "Moderate", "Rest", "Push Hard", "Light Movement"])
            shoot(app, "\(c.name)-top")
            app.swipeUp()
            shoot(app, "\(c.name)-widgets")
            app.swipeUp()
            shoot(app, "\(c.name)-lower")
        }
    }

    /// Split in two: 14 launches in one xcodebuild invocation is what kills
    /// SpringBoard on a 16 GB host (see scripts/test.sh), and a SIGKILLed
    /// app relaunches WITHOUT the fixture args -- shooting an empty,
    /// signed-out app that still looks plausible.
    func test_shots_03a_homeStates() {
        shootHome([
            ("home-moderate",        ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "healthkit"]),
            ("home-restday",         ["UITEST_SCENARIO": "activeGoalDay28Rest"]),
            ("home-day6",            ["UITEST_SCENARIO": "activeGoalDay6"]),
            ("home-eta-slipped",     ["UITEST_SCENARIO": "activeGoalWeek4Slipped"]),
            ("home-at-eta",          ["UITEST_SCENARIO": "activeGoalAtEta"]),
            ("home-no-goal",         ["UITEST_SCENARIO": "catalogOpen"]),
            ("home-trial-banner",    ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SUBSCRIPTION": "trial", "UITEST_NO_REFERRAL_BONUS": "1"]),
        ])
    }

    func test_shots_03b_homeStates() {
        shootHome([
            ("home-paid",            ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SUBSCRIPTION": "premium_annual"]),
            ("home-detected-workout",["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_DETECTED_WORKOUT": "1"]),
            ("home-sleep-oura",      ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "oura"]),
            ("home-sleep-whoop",     ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "whoop"]),
            ("home-sleep-empty",     ["UITEST_SCENARIO": "activeGoalWeek2"]),
            ("home-nutrition-perfect",["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_NUTRITION_STATE": "perfect"]),
            ("home-nutrition-over",  ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_NUTRITION_STATE": "over"]),
        ])
    }

    // MARK: - 4. Workout: the plan, the why, the payoff

    func test_shots_04_workout() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "oura", "UITEST_CLOCK_HOUR": "9"])
        settle(app, anchors: ["Lower body strength", "Moderate"])
        shoot(app, "workout-01-home-card")

        if tapIfPresent(app, "Start workout") || tapIfPresent(app, "Check workout details") {
            _ = app.scrollViews.firstMatch.waitForExistence(timeout: 20)
            sleep(2)
            shoot(app, "workout-02-detail-top")
            // SomaDisclosure swaps its own trigger label on open, so that
            // is the assertion that it actually opened -- a coordinate tap
            // that lands on nothing silently leaves the shot identical to
            // the one above.
            sleep(4)
            if openWhyThis(app) {
                sleep(1)
                shoot(app, "workout-03-why-expanded")
            }
            app.swipeUp(); shoot(app, "workout-04-plan-blocks")
            app.swipeUp(); shoot(app, "workout-05-plan-more")
            // The payoff screen: CompletedWorkoutView.
            if tapIfPresent(app, "Complete workout", timeout: 8) {
                sleep(4)
                shoot(app, "workout-06-complete")
                app.swipeUp(); shoot(app, "workout-07-complete-lower")
                // Back to Home: the fixture's week already carries logs on
                // the two preceding days, so today's completion is the only
                // thing standing between the streak tile and a real number.
                // The back control is a bare chevron with no label, so go
                // by position rather than by text.
                // The detail is a sheet, so neither the edge-swipe pop nor
                // buttons[boundBy: 0] reaches its bare chevron -- tap where
                // it draws, then fall back to dragging the sheet down.
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.10, dy: 0.121)).tap()
                sleep(3)
                if !app.staticTexts["Soma's pick"].waitForExistence(timeout: 5) {
                    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.08))
                        .press(forDuration: 0.1,
                               thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95)))
                    sleep(3)
                }
                shoot(app, "workout-08-home-after")
                app.swipeUp()
                sleep(1)
                shoot(app, "workout-09-streak")
            }
        }
    }

    // MARK: - 5. Nutrition: targets, logging, the fridge recipe, cook mode

    func test_shots_05_nutrition() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_NUTRITION_STATE": "perfect", "UITEST_CLOCK_HOUR": "13"])
        settle(app, anchors: ["Lower body strength", "Moderate"])

        guard tapIfPresent(app, "Nutrition") else { return }
        sleep(2)
        _ = app.scrollViews.firstMatch.waitForExistence(timeout: 12)
        shoot(app, "food-01-targets")
        app.swipeUp(); shoot(app, "food-02-logged")

        if tapIfPresent(app, "What can I make?") {
            sleep(2)
            shoot(app, "food-03-fridge-form")
            let field = app.textViews.firstMatch.exists ? app.textViews.firstMatch : app.textFields.firstMatch
            if field.waitForExistence(timeout: 6) {
                field.tap()
                field.typeText("salmon fillet, basmati rice, spinach, garlic, lemon")
                shoot(app, "food-04-fridge-filled")
            }
            if tapIfPresent(app, "Get a meal idea", timeout: 8) {
                sleep(6)
                shoot(app, "food-05-recipe")
                app.swipeUp(); shoot(app, "food-06-recipe-steps")
                if tapIfPresent(app, "Start cooking", timeout: 8) {
                    sleep(2)
                    shoot(app, "food-07-cook-step")
                }
            }
        }
    }

    /// Same flow as 05 but with the day still open. The `perfect` fixture
    /// leaves 0 g of carbs and fat, so the recipe card's "sized to what's
    /// left today" reads as a contradiction there; `under` does not.
    func test_shots_11_nutritionUnder() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_NUTRITION_STATE": "under", "UITEST_CLOCK_HOUR": "13"])
        settle(app, anchors: homeAnchors)
        guard tapIfPresent(app, "Nutrition") else { return }
        sleep(2)
        shoot(app, "foodu-01-targets")
        if tapIfPresent(app, "What can I make?") {
            sleep(2)
            let field = app.textViews.firstMatch.exists ? app.textViews.firstMatch : app.textFields.firstMatch
            if field.waitForExistence(timeout: 6) {
                field.tap()
                field.typeText("salmon fillet, basmati rice, spinach, garlic, lemon")
            }
            if tapIfPresent(app, "Get a meal idea", timeout: 8) {
                sleep(6)
                shoot(app, "foodu-02-recipe")
            }
        }
    }

    // MARK: - 6. Gym scan, progress, dashboard, widgets

    /// One launch per destination. HealthDashboardView has no Close button
    /// (it is a swipe-down sheet), so trying to walk from one sheet to the
    /// next inside a single launch just shoots the same sheet three times.
    ///
    /// Dock buttons carry no visible text -- DashboardDockView stamps an
    /// `.accessibilityLabel` on each, so those strings are the selectors:
    /// "Health dashboard", "Scan the gym", "Sport goal", "Nutrition",
    /// "Log workout", plus the "dock-more-button" identifier.
    func test_shots_06_scanProgressAndSettings() {
        let env = ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "oura", "UITEST_CLOCK_HOUR": "22"]

        let dash = launch(env)
        settle(dash, anchors: homeAnchors)
        if tapIfPresent(dash, "Health dashboard") {
            _ = dash.scrollViews.firstMatch.waitForExistence(timeout: 15)
            sleep(2)
            shoot(dash, "dashboard-01-overview")
            if tapIfPresent(dash, "Sleep") { sleep(1); shoot(dash, "dashboard-02-sleep") }
            if tapIfPresent(dash, "Body") { sleep(1); shoot(dash, "dashboard-03-body") }
        }

        let more = launch(env)
        settle(more, anchors: homeAnchors)
        if tapIfPresent(more, "dock-more-button") {
            sleep(1)
            shoot(more, "settings-01-more-actions")
        }

        let widgets = launch(env)
        settle(widgets, anchors: homeAnchors)
        if tapIfPresent(widgets, "Edit widgets") { sleep(2); shoot(widgets, "settings-02-edit-widgets") }

        let history = launch(env)
        settle(history, anchors: homeAnchors)
        if tapIfPresent(history, "History") { sleep(2); shoot(history, "settings-03-history-calendar") }

        let goals = launch(env)
        settle(goals, anchors: homeAnchors)
        if tapIfPresent(goals, "Sport goal") {
            _ = goals.scrollViews.firstMatch.waitForExistence(timeout: 15)
            sleep(2)
            shoot(goals, "goal-01-hub")
            goals.swipeUp(); shoot(goals, "goal-02-hub-lower")
        }
    }

    /// P1 #6 asks for water · sleep · streak · nutrition · affirmation in
    /// one frame. Every other case sets at most one of the sleep-source and
    /// nutrition knobs, so those frames always carry an empty tile or two.
    func test_shots_12_widgetsPopulated() {
        let app = launch([
            "UITEST_SCENARIO": "activeGoalWeek2",
            "UITEST_SLEEP_SOURCE": "oura",
            "UITEST_NUTRITION_STATE": "under",
        ])
        settle(app, anchors: homeAnchors)
        sleep(3)
        shoot(app, "hero-01-top")
        app.swipeUp(); sleep(1); shoot(app, "hero-02-widgets")
        app.swipeUp(); sleep(1); shoot(app, "hero-03-lower")
    }

    /// The reasoning disclosure -- P1 shot #3. Captured on Home's
    /// readiness card rather than the workout detail's copy of the same
    /// component, because the detail one does not respond to taps at all
    /// (see openWhyThis).
    func test_shots_10_whyThisOnHome() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "oura"])
        settle(app, anchors: homeAnchors)
        sleep(3)
        shoot(app, "why-01-closed")
        if tapIfPresent(app, "Why this?") {
            let opened = app.buttons["Hide"].waitForExistence(timeout: 4)
                || app.buttons["Hide details"].waitForExistence(timeout: 1)
            print(opened ? "… Home's 'Why this?' opened" : "… Home's 'Why this?' did NOT open")
            sleep(1)
            shoot(app, "why-02-expanded")
        }
    }

    /// Its own group so the status bar can sit at lunchtime while the
    /// dashboard group above sits at night.
    ///
    /// activeGoalWeek2's plan is already added to today, which puts the
    /// scan action in its "today's workout is set" alert state -- the
    /// no-plan-yet scenario is the one where scanning is actually offered.
    func test_shots_09_scanGym() {
        // Both activeGoal* scenarios ship a plan that is already added to
        // today, so the dock's scan action answers with its "today's
        // workout is set" alert. catalogOpen is the only fixture with no
        // committed plan, so it is the only one that opens the scan flow.
        let app = launch(["UITEST_SCENARIO": "catalogOpen", "UITEST_CLOCK_HOUR": "13"])
        settle(app, anchors: homeAnchors)
        shoot(app, "scan-00-home")
        if tapIfPresent(app, "Scan the gym") {
            sleep(3)
            shoot(app, "scan-01-pick-photo")
            app.swipeUp(); shoot(app, "scan-02-lower")
        }
    }

    /// Connect Device is where AppState resumes a signed-in, unfinished
    /// onboarding -- no UITEST_POSTSETUP, so nothing steers past it.
    func test_shots_08_connectDevices() {
        let app = launch([:], args: ["--ui-test-onboarding-demo-resume"])
        settle(app, anchors: ["Connect your devices."])
        sleep(2)
        shoot(app, "setup-01-connect-devices")
        if tapIfPresent(app, "Continue", timeout: 8) {
            sleep(2)
            shoot(app, "setup-02-notifications")
        }
    }

    /// The ETA-slipped goal hub -- the "the plan admitted it slipped" shot.
    func test_shots_07_goalSlipped() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek4Slipped", "UITEST_CLOCK_HOUR": "22"])
        settle(app, anchors: homeAnchors)
        shoot(app, "slipped-01-home")
        if tapIfPresent(app, "Sport goal") {
            _ = app.scrollViews.firstMatch.waitForExistence(timeout: 15)
            sleep(2)
            shoot(app, "slipped-02-hub")
            app.swipeUp(); shoot(app, "slipped-03-hub-lower")
        }
    }

    // MARK: - 14. Custom goal — "Your own plan": the form, the safety
    // conflict, the running goal's hub, and the coach block in the daily
    // plan. Navigation mirrors UITests/SportGoalJourneyTests (J23).
    // NOTE for marketing use: never ship a frame where the curated program
    // chips row is legible — third-party program names are not cleared for
    // ads. The generic typed plan below keeps these frames safe.

    private func openCustomGoalForm(_ app: XCUIApplication) -> Bool {
        if tapIfPresent(app, "dock-more-button") { tapIfPresent(app, "Goals") }
        settle(app, anchors: ["What do you train for?"])
        tapIfPresent(app, "Volleyball")
        guard tapIfPresent(app, "Your own plan", timeout: 10) else { return false }
        return app.descendants(matching: .any)["workoutTextField"].waitForExistence(timeout: 10)
    }

    /// Fills the two text fields and lands with the keyboard dismissed: the
    /// coach-name field is single-line, so its Return key retires the
    /// keyboard. NEVER app.swipeDown() here — the flow lives in a sheet and
    /// a window-level swipe-down dismisses the whole thing (that is exactly
    /// how the first run of these shots produced six pictures of Home).
    private func fillCustomGoalForm(_ app: XCUIApplication, workoutText: String) {
        let workout = app.descendants(matching: .any)["workoutTextField"]
        workout.tap()
        workout.typeText(workoutText)
        let coach = app.descendants(matching: .any)["coachNameField"]
        if coach.waitForExistence(timeout: 5) {
            coach.tap()
            coach.typeText("Elena\n")
        }
        sleep(1)
    }

    func test_shots_14a_customGoalForm() {
        let app = launch(["UITEST_SCENARIO": "customCoachFlow"])
        settle(app, anchors: homeAnchors)
        guard openCustomGoalForm(app) else { return }
        // No empty-form shot on purpose: with nothing typed the curated
        // program chips row shows third-party program names, which are not
        // cleared for marketing frames.
        fillCustomGoalForm(app, workoutText: "Tue / Thu / Sat — jump rope 10 min, split squats 4x8 each side, banded lateral walks, core circuit, hill sprints 6x40m")
        shoot(app, "goal-form-filled")
        app.swipeUp(); sleep(1)
        shoot(app, "goal-form-schedule")
        // The baseline ruler only exists once "Track a measurable" is on.
        let toggle = app.switches.firstMatch
        if toggle.waitForExistence(timeout: 5) {
            toggle.tap()
            let name = app.textFields.matching(
                NSPredicate(format: "placeholderValue CONTAINS 'measuring'")).firstMatch
            if name.waitForExistence(timeout: 5) {
                name.tap()
                name.typeText("Approach jump")
                let unit = app.textFields.matching(
                    NSPredicate(format: "placeholderValue CONTAINS 'Unit'")).firstMatch
                if unit.waitForExistence(timeout: 3) {
                    unit.tap()
                    unit.typeText("cm\n")
                }
            }
            sleep(1)
            app.swipeUp(); sleep(1)
            // Drag the baseline ruler off its default 20 toward the deck's
            // "41 cm" — the exact landing value gets read off the shot and
            // the deck copy matched to it, not the other way round.
            let strip = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.73))
            strip.press(forDuration: 0.2,
                        thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.12, dy: 0.73)))
            sleep(1)
            shoot(app, "goal-form-ruler")
        }
    }

    func test_shots_14b_customGoalConflict() {
        let app = launch(["UITEST_SCENARIO": "customCoachFlow"])
        settle(app, anchors: homeAnchors)
        guard openCustomGoalForm(app) else { return }
        // "depth jump" is the fixture's conflict sentinel (UITestSupport's
        // create-goal stub) — mirrors the real endpoint's injury keyword pass.
        fillCustomGoalForm(app, workoutText: "Plyometric block — depth jumps 5x5, pogo hops 3x20, weighted step-downs")
        app.swipeUp(); sleep(1)
        if tapIfPresent(app, "Start the block", timeout: 8) {
            settle(app, anchors: ["conflicts with an injury", "mentions"], timeout: 10)
            sleep(1)
            shoot(app, "goal-conflict")
        }
    }

    func test_shots_14c_customGoalHub() {
        let app = launch(["UITEST_SCENARIO": "customGoalWeek2"])
        settle(app, anchors: homeAnchors)
        shoot(app, "goal-home-custom")
        if tapIfPresent(app, "Sport goal") {
            _ = app.scrollViews.firstMatch.waitForExistence(timeout: 15)
            sleep(2)
            shoot(app, "goal-hub-custom")
            app.swipeUp(); sleep(1)
            shoot(app, "goal-hub-custom-lower")
        }
    }

    func test_shots_14d_customGoalCoachBlock() {
        let app = launch(["UITEST_SCENARIO": "customGoalItemized"])
        settle(app, anchors: homeAnchors)
        // The detail opens from the card's own CTA, same as test 04.
        guard tapIfPresent(app, "Start workout") || tapIfPresent(app, "Check workout details") else { return }
        _ = app.scrollViews.firstMatch.waitForExistence(timeout: 20)
        sleep(3)
        shoot(app, "goal-plan-top")
        app.swipeUp(); sleep(1)
        shoot(app, "goal-coach-block")
        app.swipeUp(); sleep(1)
        shoot(app, "goal-coach-block-lower")
    }
}
