/*
 * Copyright 2017-2022 EPAM Systems, Inc. (https://www.epam.com/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.epam.pipeline.autotests;

import com.epam.pipeline.autotests.ao.NotificationAO;
import com.epam.pipeline.autotests.ao.SettingsPageAO;
import com.epam.pipeline.autotests.ao.ToolTab;
import com.epam.pipeline.autotests.mixins.Authorization;
import com.epam.pipeline.autotests.utils.C;
import com.epam.pipeline.autotests.utils.TestCase;
import com.epam.pipeline.autotests.utils.Utils;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;

import static com.codeborne.selenide.Condition.enabled;
import static com.codeborne.selenide.Selectors.byClassName;
import static com.codeborne.selenide.Selectors.byXpath;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.refresh;
import static com.epam.pipeline.autotests.ao.LogAO.Status.PAUSED;
import static com.epam.pipeline.autotests.ao.Primitive.AUTOSCALED;
import static com.epam.pipeline.autotests.ao.Primitive.CLOUD_REGION;
import static com.epam.pipeline.autotests.ao.Primitive.COMMIT;
import static com.epam.pipeline.autotests.ao.Primitive.DISK;
import static com.epam.pipeline.autotests.ao.Primitive.ENDS_ON;
import static com.epam.pipeline.autotests.ao.Primitive.ENDS_ON_TIME;
import static com.epam.pipeline.autotests.ao.Primitive.INFO;
import static com.epam.pipeline.autotests.ao.Primitive.INSTANCE_TYPE;
import static com.epam.pipeline.autotests.ao.Primitive.PAUSE;
import static com.epam.pipeline.autotests.ao.Primitive.POOL_NAME;
import static com.epam.pipeline.autotests.ao.Primitive.PRICE_TYPE;
import static com.epam.pipeline.autotests.ao.Primitive.RESUME;
import static com.epam.pipeline.autotests.ao.Primitive.STARTS_ON;
import static com.epam.pipeline.autotests.ao.Primitive.STARTS_ON_TIME;
import static com.epam.pipeline.autotests.utils.Utils.nameWithoutGroup;
import static com.epam.pipeline.autotests.utils.Utils.randomSuffix;
import static java.lang.String.format;
import static java.time.format.TextStyle.FULL;
import static java.util.Locale.getDefault;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.testng.Assert.assertFalse;

public class MaintenanceModeTest extends AbstractSeveralPipelineRunningTest implements Authorization {

    private final String testSystemMaintenanceModeBanner = "Test of maintenance mode. Some of the features are disabled.";
    private final String maintenanceModeTooltip = "Platform is in a maintenance mode, operation is temporary unavailable";
    private final String titleText = "Maintenance mode";
    private final String tool = C.TESTING_TOOL_NAME;
    private final String registry = C.DEFAULT_REGISTRY;
    private final String group = C.DEFAULT_GROUP;
    private final String defaultInstance = C.DEFAULT_INSTANCE;
    private final String poolName = "testpool2423"; //format("test_pool-%s", randomSuffix());
    private final String version = format("version-%s", randomSuffix());

    private String defaultSystemMaintenanceModeBanner;
    private String run1ID = "";
    private String run2ID = "";
    private String run3ID = "";
    private String[] defaultRegion;

    @BeforeClass(alwaysRun = true)
    public void getDefaultPreferences() {
        defaultSystemMaintenanceModeBanner = navigationMenu()
                .settings()
                .switchToPreferences()
                .switchToSystem()
                .getSystemMaintenanceModeBanner();
        defaultRegion = navigationMenu()
                .settings()
                .switchToPreferences()
                .switchToCluster()
                .getLinePreference("default.edge.region");
    }

    @AfterClass(alwaysRun = true)
    public void restorePreferences() {
        navigationMenu()
                .settings()
                .switchToPreferences()
                .switchToSystem()
                .setSystemMaintenanceModeBanner(defaultSystemMaintenanceModeBanner)
                .switchToSystem()
                .disableSystemMaintenanceMode()
                .saveIfNeeded();
        runsMenu()
                .resume(run2ID, nameWithoutGroup(tool))
                .waitUntilPauseButtonAppear(run2ID);
        clusterMenu()
                .switchToHotNodePool()
                .searchForNodeEntry(poolName)
                .deleteNode(poolName);
    }

    @Test(priority = 1)
    @TestCase(value = {"2423_1"})
    public void maintenanceModeNotification() {
        setSystemMaintenanceModeBanner(testSystemMaintenanceModeBanner);
        setEnableSystemMaintenanceMode();
        new NotificationAO(titleText)
                .ensureSeverityIs(INFO.name())
                .ensureTitleIs(titleText)
                .ensureBodyIs(testSystemMaintenanceModeBanner)
                .close();
        navigationMenu()
                .settings()
                .switchToPreferences()
                .switchToSystem()
                .setEmptySystemMaintenanceModeBanner()
                .save();
        refresh();
        ensureNotificationIsAbsent(titleText);
    }

    @Test(priority = 2, dependsOnMethods = {"maintenanceModeNotification"})
    @TestCase(value = {"2423_2"})
    public void checkLaunchRunInMaintenanceMode() {
        navigationMenu()
                .tools()
                .perform(registry, group, tool, ToolTab::runWithCustomSettings)
                .setPriceType("On-demand")
                .doNotMountStoragesSelect(true)
                .launch(this)
                .waitUntilPauseButtonAppear(run1ID = getLastRunId())
                .ensurePauseButtonDisabled(run1ID)
                .checkPauseButtonTooltip(run1ID, maintenanceModeTooltip)
                .showLog(run1ID)
                .ensureButtonDisabled(PAUSE)
                .ensureButtonDisabled(COMMIT)
                .checkButtonTooltip(PAUSE, maintenanceModeTooltip)
                .checkButtonTooltip(COMMIT, maintenanceModeTooltip);
        home()
                .checkPauseLinkIsDisabledOnActiveRunsPanel(run1ID)
                .checkActiveRunPauseLinkTooltip(run1ID, maintenanceModeTooltip);
        setDisableSystemMaintenanceMode();
        navigationMenu()
                .runs()
                .showLog(run1ID)
                .ensureAll(enabled, PAUSE, COMMIT);
    }

    @Test(priority = 4, dependsOnMethods = {"checkLaunchRunInMaintenanceMode"})
    @TestCase(value = {"2423_3"})
    public void checkSwitchToMaintenanceModeDuringTheRunCommittingOperation() {
        try {
            setDisableSystemMaintenanceMode();
            runsMenu()
                    .log(run1ID, log ->
                            log.waitForCommitButton()
                                    .commit(commit ->
                                            commit.sleep(1, SECONDS)
                                                    .setVersion(version)
                                                    .sleep(1, SECONDS)
                                                    .ok())
                    );
            setEnableSystemMaintenanceMode();
            runsMenu()
                    .showLog(run1ID)
                    .assertCommittingFinishedSuccessfully()
                    .ensureButtonDisabled(PAUSE)
                    .ensureButtonDisabled(COMMIT);
        } finally {
            tools()
                    .perform(registry, group, tool, tool ->
                            tool.versions()
                                    .viewUnscannedVersions()
                                    .performIf(hasOnPage(version), t -> t.deleteVersion(version))
                    );
        }

    }

    @Test(priority = 4, dependsOnMethods = {"maintenanceModeNotification"})
    @TestCase(value = {"2423_4"})
    public void checkSwitchToMaintenanceModeDuringTheRunPausingAndResumingOperation() {
        setDisableSystemMaintenanceMode();
        navigationMenu()
                .tools()
                .perform(registry, group, tool, ToolTab::runWithCustomSettings)
                .setPriceType("On-demand")
                .doNotMountStoragesSelect(true)
                .launch(this);
        run2ID = getLastRunId();
        navigationMenu()
                .tools()
                .perform(registry, group, tool, ToolTab::runWithCustomSettings)
                .setPriceType("On-demand")
                .doNotMountStoragesSelect(true)
                .launch(this)
                .waitUntilPauseButtonAppear(run3ID = getLastRunId())
                .pause(run3ID, nameWithoutGroup(tool))
                .waitUntilResumeButtonAppear(run3ID);
        runsMenu()
                .pause(run2ID, nameWithoutGroup(tool))
                .resume(run3ID, nameWithoutGroup(tool));
        setEnableSystemMaintenanceMode();
        runsMenu()
                .showLog(run2ID)
                .waitForDisabledButton(RESUME)
                .ensureButtonDisabled(RESUME)
                .checkButtonTooltip(RESUME, maintenanceModeTooltip)
                .shouldHaveStatus(PAUSED);
        runsMenu()
                .showLog(run3ID)
                .waitForDisabledButton(PAUSE)
                .ensureButtonDisabled(PAUSE)
                .ensureButtonDisabled(COMMIT);
        setDisableSystemMaintenanceMode();
    }

    @Test(priority = 3, dependsOnMethods = {"maintenanceModeNotification"})
    @TestCase(value = {"2423_5"})
    public void hotNodePoolInMaintenanceMode() {
        DayOfWeek day = LocalDate.now().getDayOfWeek();
        String currentDay = day.getDisplayName(FULL, getDefault());
        String nextDay = day.plus(1).getDisplayName(FULL, getDefault());
        setDisableSystemMaintenanceMode();
            clusterMenu()
                    .switchToHotNodePool()
                    .clickCreatePool()
                    .setValue(POOL_NAME, poolName)
                    .selectValue(STARTS_ON, currentDay)
                    .setScheduleTime(STARTS_ON_TIME, "00:00")
                    .selectValue(ENDS_ON, nextDay)
                    .setScheduleTime(ENDS_ON_TIME, "23:59")
                    .selectValue(INSTANCE_TYPE, defaultInstance)
                    .selectValue(CLOUD_REGION, defaultRegion[0])
                    .setValue(DISK, "20")
                    .click(AUTOSCALED)
                    .setAutoscaledParameter("Min Size", 2)
                    .setAutoscaledParameter("Max Size", 4)
                    .setAutoscaledParameter("Scale Up Threshold", 70)
                    .setAutoscaledParameter("Scale Step", 1)
                    .addDockerImage(registry, group, tool)
                    .ok()
                    .waitUntilRunningNodesAppear(poolName, 2);
            launchTool();
            clusterMenu()
                    .switchToHotNodePool()
                    .waitUntilActiveNodesAppear(poolName, 1)
                    .switchToCluster()
                    .checkNodeContainsHotNodePoolsLabel(getLastRunId(), poolName);
            launchTool();
            clusterMenu()
                    .switchToHotNodePool()
                    .waitUntilActiveNodesAppear(poolName, 2)
                    .waitUntilRunningNodesAppear(poolName, 3)
                    .switchToCluster()
                    .checkNodeContainsHotNodePoolsLabel(getLastRunId(), poolName);
            setEnableSystemMaintenanceMode();
            launchTool();
            clusterMenu()
                    .checkNodeContainsHotNodePoolsLabel(getLastRunId(), poolName)
                    .switchToHotNodePool()
                    .waitUntilActiveNodesAppear(poolName, 3)
                    .waitUntilRunningNodesAppear(poolName, 3);
            launchTool();
            clusterMenu()
                    .checkNodeNotContainsHotNodePoolsLabel(getLastRunId(), poolName);
    }

    private SettingsPageAO.PreferencesAO setSystemMaintenanceModeBanner(String textBanner) {
        return navigationMenu()
                .settings()
                .switchToPreferences()
                .switchToSystem()
                .setSystemMaintenanceModeBanner(textBanner)
                .saveIfNeeded();
    }

    private SettingsPageAO.PreferencesAO setEnableSystemMaintenanceMode() {
        return navigationMenu()
                .settings()
                .switchToPreferences()
                .switchToSystem()
                .enableSystemMaintenanceMode()
                .saveIfNeeded();
    }

    private SettingsPageAO.PreferencesAO setDisableSystemMaintenanceMode() {
        return navigationMenu()
                .settings()
                .switchToPreferences()
                .switchToSystem()
                .disableSystemMaintenanceMode()
                .saveIfNeeded();
    }

    private void ensureNotificationIsAbsent(String title) {
        assertFalse($(byXpath(format("//*[contains(@class, 'system-notification__container') and contains(., '%s')]",
                title))).exists());
    }

    private void launchTool() {
        tools()
                .perform(registry, group, tool, ToolTab::runWithCustomSettings)
                .setTypeValue(defaultInstance)
                .setDisk("15")
                .selectValue(PRICE_TYPE, "Spot")
                .launchTool(this, Utils.nameWithoutGroup(tool))
                .showLog(getLastRunId())
                .waitForIP();
    }

    private boolean hasOnPage(String customTag) {
        return $(byClassName("ant-table-tbody"))
                .find(byXpath(String.format(".//tr[contains(@class, 'ant-table-row-level-0') and contains(., '%s')]", customTag)))
                .exists();
    }
}
