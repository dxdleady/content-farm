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

    private func launch(_ env: [String: String], args: [String] = ["--ui-test-fixtures"]) -> XCUIApplication {
        runningApp?.terminate()
        let app = XCUIApplication()
        app.launchArguments = args
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

    /// Taps a button if it is there. Returns whether it was.
    @discardableResult
    private func tapIfPresent(_ app: XCUIApplication, _ label: String, timeout: TimeInterval = 6) -> Bool {
        let b = app.buttons[label].firstMatch
        guard b.waitForExistence(timeout: timeout) else {
            print("… no button '\(label)' — skipping that shot")
            return false
        }
        b.tap()
        return true
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

        // PostSetup steps are reachable by name; paywall is Superwall-rendered.
        for step in ["loading", "consent", "planSummary", "bodyPhotos", "tryFree", "trialReminder", "paywall"] {
            let app = launch(["UITEST_POSTSETUP": step], args: ["--ui-test-onboarding-demo-resume"])
            _ = app.otherElements.firstMatch.waitForExistence(timeout: 12)
            shoot(app, "postsetup-\(step)")
        }
    }

    // MARK: - 3. The daily home, every state that changes what it says

    func test_shots_03_homeStates() {
        let cases: [(name: String, env: [String: String])] = [
            ("home-moderate",        ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "healthkit"]),
            ("home-restday",         ["UITEST_SCENARIO": "activeGoalDay28Rest"]),
            ("home-day6",            ["UITEST_SCENARIO": "activeGoalDay6"]),
            ("home-eta-slipped",     ["UITEST_SCENARIO": "activeGoalWeek4Slipped"]),
            ("home-at-eta",          ["UITEST_SCENARIO": "activeGoalAtEta"]),
            ("home-no-goal",         ["UITEST_SCENARIO": "catalogOpen"]),
            ("home-trial-banner",    ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SUBSCRIPTION": "trial"]),
            ("home-paid",            ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SUBSCRIPTION": "premium_annual"]),
            ("home-detected-workout",["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_DETECTED_WORKOUT": "1"]),
            ("home-sleep-oura",      ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "oura"]),
            ("home-sleep-whoop",     ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "whoop"]),
            ("home-sleep-empty",     ["UITEST_SCENARIO": "activeGoalWeek2"]),
            ("home-nutrition-perfect",["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_NUTRITION_STATE": "perfect"]),
            ("home-nutrition-over",  ["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_NUTRITION_STATE": "over"]),
        ]
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

    // MARK: - 4. Workout: the plan, the why, the payoff

    func test_shots_04_workout() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "oura"])
        settle(app, anchors: ["Lower body strength", "Moderate"])
        shoot(app, "workout-01-home-card")

        if tapIfPresent(app, "Start workout") || tapIfPresent(app, "Check workout details") {
            _ = app.scrollViews.firstMatch.waitForExistence(timeout: 20)
            shoot(app, "workout-02-detail-top")
            if tapIfPresent(app, "Why this?") { shoot(app, "workout-03-why-expanded") }
            app.swipeUp(); shoot(app, "workout-04-plan-blocks")
            app.swipeUp(); shoot(app, "workout-05-plan-more")
        }
    }

    // MARK: - 5. Nutrition: targets, logging, the fridge recipe, cook mode

    func test_shots_05_nutrition() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_NUTRITION_STATE": "perfect"])
        settle(app, anchors: ["Lower body strength", "Moderate"])

        guard tapIfPresent(app, "Nutrition") else { return }
        _ = app.scrollViews.firstMatch.waitForExistence(timeout: 12)
        shoot(app, "food-01-targets")
        app.swipeUp(); shoot(app, "food-02-logged")

        if tapIfPresent(app, "What can I make?") {
            shoot(app, "food-03-fridge-form")
            app.swipeUp(); shoot(app, "food-04-recipe")
        }
    }

    // MARK: - 6. Gym scan, progress, dashboard, widgets

    func test_shots_06_scanProgressAndSettings() {
        let app = launch(["UITEST_SCENARIO": "activeGoalWeek2", "UITEST_SLEEP_SOURCE": "oura"])
        settle(app, anchors: ["Lower body strength", "Moderate"])

        if tapIfPresent(app, "Scan gym") {
            shoot(app, "scan-01-pick-photo")
            if !tapIfPresent(app, "Close") { _ = tapIfPresent(app, "Cancel") }
        }
        if tapIfPresent(app, "Dashboard") {
            _ = app.scrollViews.firstMatch.waitForExistence(timeout: 12)
            shoot(app, "dashboard-01-overview")
            _ = tapIfPresent(app, "Sleep"); shoot(app, "dashboard-02-sleep")
            if !tapIfPresent(app, "Close") { _ = tapIfPresent(app, "Done") }
        }
        if tapIfPresent(app, "dock-more-button") {
            shoot(app, "settings-01-more-actions")
            if tapIfPresent(app, "Edit widgets") { shoot(app, "settings-02-edit-widgets") }
        }
    }
}
