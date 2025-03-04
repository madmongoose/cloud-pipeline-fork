/*
 * Copyright 2017-2021 EPAM Systems, Inc. (https://www.epam.com/)
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

package com.epam.pipeline.test.acl;

import com.epam.pipeline.common.MessageHelper;
import com.epam.pipeline.dao.contextual.ContextualPreferenceDao;
import com.epam.pipeline.dao.datastorage.DataStorageDao;
import com.epam.pipeline.dao.datastorage.rules.DataStorageRuleDao;
import com.epam.pipeline.dao.docker.DockerRegistryDao;
import com.epam.pipeline.dao.notification.MonitoringNotificationDao;
import com.epam.pipeline.dao.pipeline.FolderDao;
import com.epam.pipeline.dao.pipeline.PipelineDao;
import com.epam.pipeline.dao.pipeline.PipelineRunDao;
import com.epam.pipeline.dao.pipeline.RestartRunDao;
import com.epam.pipeline.dao.pipeline.RunLogDao;
import com.epam.pipeline.dao.pipeline.RunStatusDao;
import com.epam.pipeline.dao.pipeline.StopServerlessRunDao;
import com.epam.pipeline.dao.user.GroupStatusDao;
import com.epam.pipeline.dao.user.RoleDao;
import com.epam.pipeline.dao.user.UserDao;
import com.epam.pipeline.manager.EntityManager;
import com.epam.pipeline.manager.HierarchicalEntityManager;
import com.epam.pipeline.manager.billing.BillingManager;
import com.epam.pipeline.manager.cloud.TemporaryCredentialsManager;
import com.epam.pipeline.manager.cloud.credentials.CloudProfileCredentialsManagerProvider;
import com.epam.pipeline.manager.cluster.EdgeServiceManager;
import com.epam.pipeline.manager.cluster.InfrastructureManager;
import com.epam.pipeline.manager.cluster.InstanceOfferManager;
import com.epam.pipeline.manager.cluster.NatGatewayManager;
import com.epam.pipeline.manager.cluster.NodeDiskManager;
import com.epam.pipeline.manager.cluster.NodesManager;
import com.epam.pipeline.manager.cluster.performancemonitoring.UsageMonitoringManager;
import com.epam.pipeline.manager.cluster.pool.NodePoolManager;
import com.epam.pipeline.manager.cluster.pool.NodePoolUsageService;
import com.epam.pipeline.manager.cluster.pool.NodeScheduleManager;
import com.epam.pipeline.manager.configuration.RunConfigurationManager;
import com.epam.pipeline.manager.configuration.ServerlessConfigurationManager;
import com.epam.pipeline.manager.contextual.ContextualPreferenceManager;
import com.epam.pipeline.manager.contextual.handler.ContextualPreferenceHandler;
import com.epam.pipeline.manager.datastorage.DataStorageManager;
import com.epam.pipeline.manager.datastorage.DataStoragePathLoader;
import com.epam.pipeline.manager.datastorage.DataStorageRuleManager;
import com.epam.pipeline.manager.datastorage.DataStorageValidator;
import com.epam.pipeline.manager.datastorage.FileShareMountManager;
import com.epam.pipeline.manager.datastorage.RunMountService;
import com.epam.pipeline.manager.datastorage.StorageProviderManager;
import com.epam.pipeline.manager.datastorage.convert.DataStorageConvertManager;
import com.epam.pipeline.manager.datastorage.lustre.LustreFSManager;
import com.epam.pipeline.manager.datastorage.tag.DataStorageTagBatchManager;
import com.epam.pipeline.manager.datastorage.tag.DataStorageTagManager;
import com.epam.pipeline.manager.datastorage.tag.DataStorageTagProviderManager;
import com.epam.pipeline.manager.docker.DockerClientFactory;
import com.epam.pipeline.manager.docker.DockerContainerOperationManager;
import com.epam.pipeline.manager.docker.DockerRegistryManager;
import com.epam.pipeline.manager.docker.ToolVersionManager;
import com.epam.pipeline.manager.docker.scan.ToolScanManager;
import com.epam.pipeline.manager.docker.scan.ToolScanScheduler;
import com.epam.pipeline.manager.dts.DtsListingManager;
import com.epam.pipeline.manager.dts.DtsRegistryManager;
import com.epam.pipeline.manager.dts.DtsSubmissionManager;
import com.epam.pipeline.manager.event.EntityEventServiceManager;
import com.epam.pipeline.manager.execution.CommandBuilder;
import com.epam.pipeline.manager.execution.PipelineLauncher;
import com.epam.pipeline.manager.filter.FilterManager;
import com.epam.pipeline.manager.firecloud.FirecloudManager;
import com.epam.pipeline.manager.git.GitManager;
import com.epam.pipeline.manager.git.PipelineRepositoryService;
import com.epam.pipeline.manager.git.TemplatesScanner;
import com.epam.pipeline.manager.google.CredentialsManager;
import com.epam.pipeline.manager.issue.IssueManager;
import com.epam.pipeline.manager.log.LogManager;
import com.epam.pipeline.manager.metadata.CategoricalAttributeManager;
import com.epam.pipeline.manager.metadata.MetadataDownloadManager;
import com.epam.pipeline.manager.metadata.MetadataEntityManager;
import com.epam.pipeline.manager.metadata.MetadataManager;
import com.epam.pipeline.manager.metadata.MetadataUploadManager;
import com.epam.pipeline.manager.metadata.processor.MetadataPostProcessorService;
import com.epam.pipeline.manager.notification.NotificationManager;
import com.epam.pipeline.manager.notification.NotificationSettingsManager;
import com.epam.pipeline.manager.notification.NotificationTemplateManager;
import com.epam.pipeline.manager.notification.SystemNotificationManager;
import com.epam.pipeline.manager.ontology.OntologyManager;
import com.epam.pipeline.manager.pipeline.DocumentGenerationPropertyManager;
import com.epam.pipeline.manager.pipeline.FolderCrudManager;
import com.epam.pipeline.manager.pipeline.FolderManager;
import com.epam.pipeline.manager.pipeline.FolderTemplateManager;
import com.epam.pipeline.manager.pipeline.ParameterMapper;
import com.epam.pipeline.manager.pipeline.PipelineConfigurationManager;
import com.epam.pipeline.manager.pipeline.PipelineFileGenerationManager;
import com.epam.pipeline.manager.pipeline.PipelineManager;
import com.epam.pipeline.manager.pipeline.PipelineRunAsManager;
import com.epam.pipeline.manager.pipeline.PipelineRunCRUDService;
import com.epam.pipeline.manager.pipeline.PipelineRunDockerOperationManager;
import com.epam.pipeline.manager.pipeline.PipelineRunKubernetesManager;
import com.epam.pipeline.manager.pipeline.PipelineRunManager;
import com.epam.pipeline.manager.pipeline.PipelineVersionManager;
import com.epam.pipeline.manager.pipeline.RestartRunManager;
import com.epam.pipeline.manager.pipeline.RunLogManager;
import com.epam.pipeline.manager.pipeline.RunScheduleManager;
import com.epam.pipeline.manager.pipeline.RunStatusManager;
import com.epam.pipeline.manager.pipeline.StopServerlessRunManager;
import com.epam.pipeline.manager.pipeline.ToolGroupManager;
import com.epam.pipeline.manager.pipeline.ToolManager;
import com.epam.pipeline.manager.pipeline.ToolScanInfoManager;
import com.epam.pipeline.manager.pipeline.runner.ConfigurationProviderManager;
import com.epam.pipeline.manager.pipeline.runner.ConfigurationRunner;
import com.epam.pipeline.manager.preference.PreferenceManager;
import com.epam.pipeline.manager.preprocessing.NgsPreprocessingManager;
import com.epam.pipeline.manager.quota.QuotaService;
import com.epam.pipeline.manager.quota.RunLimitsService;
import com.epam.pipeline.manager.region.CloudRegionManager;
import com.epam.pipeline.manager.report.NodePoolReportService;
import com.epam.pipeline.manager.report.UsersUsageReportService;
import com.epam.pipeline.manager.search.SearchManager;
import com.epam.pipeline.manager.security.AuthManager;
import com.epam.pipeline.manager.security.GrantPermissionManager;
import com.epam.pipeline.manager.security.PermissionsService;
import com.epam.pipeline.manager.user.OnlineUsersService;
import com.epam.pipeline.manager.user.RoleManager;
import com.epam.pipeline.manager.user.UserManager;
import com.epam.pipeline.manager.user.UserRunnersManager;
import com.epam.pipeline.manager.user.UsersFileImportManager;
import com.epam.pipeline.manager.utils.JsonService;
import com.epam.pipeline.manager.utils.UtilsManager;
import com.epam.pipeline.mapper.AbstractEntityPermissionMapper;
import com.epam.pipeline.mapper.AbstractRunConfigurationMapper;
import com.epam.pipeline.mapper.MetadataEntryMapper;
import com.epam.pipeline.mapper.PermissionGrantVOMapper;
import com.epam.pipeline.mapper.PipelineWithPermissionsMapper;
import com.epam.pipeline.security.acl.JdbcMutableAclServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.acls.domain.AclAuthorizationStrategy;
import org.springframework.security.acls.domain.PermissionFactory;
import org.springframework.security.acls.model.AclCache;

import javax.sql.DataSource;
import java.util.concurrent.Executor;

import static org.mockito.Mockito.spy;

@Configuration
public class AclTestBeans {

    @Autowired
    protected PermissionFactory permissionFactory;

    @Autowired
    protected PermissionEvaluator permissionEvaluator;

    @Autowired
    protected MessageHelper messageHelper;

    @Autowired
    protected PermissionsService permissionsService;

    @MockBean(name = "aclService")
    protected JdbcMutableAclServiceImpl mockAclService;

    @MockBean
    protected AuthManager mockAuthManager;

    @MockBean
    protected EntityManager mockEntityManager;

    @MockBean
    protected IssueManager mockIssueManager;

    @MockBean
    protected MetadataEntityManager mockMetadataEntityManager;

    @MockBean
    protected NodesManager mockNodesManager;

    @MockBean
    protected DataSource mockDataSource;

    @MockBean(name = "aclCache")
    protected AclCache mockAclCache;

    @MockBean
    protected CacheManager mockCacheManager;

    @MockBean
    protected LogManager mockLogManager;

    @MockBean
    protected BillingManager mockBillingManager;

    @MockBean
    protected PipelineVersionManager mockPipelineVersionManager;

    @MockBean
    protected PipelineRunManager mockPipelineRunManager;

    @MockBean
    protected InstanceOfferManager mockInstanceOfferManager;

    @MockBean
    protected GitManager mockGitManager;

    @MockBean
    protected PipelineFileGenerationManager mockPipelineFileGenerationManager;

    @MockBean
    protected DocumentGenerationPropertyManager mockDocumentGenerationPropertyManager;

    @MockBean
    protected ToolManager mockToolManager;

    @MockBean
    protected ToolGroupManager mockToolGroupManager;

    @MockBean
    protected DockerRegistryManager mockDockerRegistryManager;

    @MockBean
    protected RunConfigurationManager mockRunConfigurationManager;

    @MockBean
    protected FolderManager mockFolderManager;

    @MockBean
    protected ConfigurationProviderManager mockConfigurationProviderManager;

    @MockBean
    protected EntityEventServiceManager mockEntityEventServiceManager;

    @MockBean
    protected FilterManager mockFilterManager;

    @MockBean
    protected RunLogManager mockRunLogManager;

    @MockBean
    protected UtilsManager mockUtilsManager;

    @MockBean
    protected RunScheduleManager mockRunScheduleManager;

    @MockBean
    protected MessageHelper mockMessageHelper;

    @MockBean
    protected AclAuthorizationStrategy mockAclAuthorizationStrategy;

    @MockBean
    protected AbstractEntityPermissionMapper mockAbstractEntityPermissionMapper;

    @MockBean
    protected PipelineWithPermissionsMapper mockPipelineWithPermissionsMapper;

    @MockBean
    protected ConfigurationRunner mockConfigurationRunner;

    @MockBean
    protected AbstractRunConfigurationMapper mockRunConfigurationMapper;

    @MockBean
    protected MetadataManager mockMetaDataManager;

    @MockBean
    protected DataStorageRuleManager mockDataStorageRuleManager;

    @MockBean
    protected DataStorageTagBatchManager mockDataStorageTagBatchManager;

    @MockBean
    protected DataStorageTagManager mockDataStorageTagManager;

    @MockBean
    protected DataStorageTagProviderManager mockDataStorageTagProviderManager;

    @MockBean
    protected DataStorageConvertManager mockDataStorageConvertManager;

    @MockBean
    protected ToolScanScheduler mockToolScanScheduler;

    @MockBean
    protected ToolScanManager mockToolScanManager;

    @MockBean
    protected DtsRegistryManager mockDtsRegistryManager;

    @MockBean
    protected FirecloudManager mockFirecloudManager;

    @MockBean
    protected MetadataUploadManager mockMetadataUploadManager;

    @MockBean
    protected NotificationSettingsManager mockNotificationSettingsManager;

    @MockBean
    protected NotificationTemplateManager mockNotificationTemplateManager;

    @MockBean
    protected SystemNotificationManager mockSystemNotificationManager;

    @MockBean
    protected MetadataEntryMapper mockMetadataEntryMapper;

    @MockBean
    protected PermissionGrantVOMapper mockPermissionGrantVOMapper;

    @MockBean
    protected MetadataPostProcessorService mockMetadataPostProcessorService;

    @MockBean
    protected CloudRegionManager mockCloudRegionManager;

    @MockBean
    protected StorageProviderManager mockStorageProviderManager;

    @MockBean
    protected DataStorageDao mockDataStorageDao;

    @MockBean
    protected FileShareMountManager mockFileShareMountManager;

    @MockBean
    protected Executor mockExecutor;

    @MockBean
    protected SearchManager mockSearchManager;

    @MockBean
    protected DataStoragePathLoader mockDataStoragePathLoader;

    @MockBean
    protected FolderDao mockFolderDao;

    @MockBean
    protected PreferenceManager mockPreferenceManager;

    @MockBean
    protected NodeDiskManager mockNodeDiskManager;

    @MockBean
    protected UsageMonitoringManager mockUsageMonitoringManager;

    @MockBean
    protected ContextualPreferenceManager mockContextualPreferenceManager;

    @MockBean
    protected ToolVersionManager mockToolVersionManager;

    @MockBean
    protected PipelineDao mockPipelineDao;

    @MockBean
    protected DataStorageRuleDao mockDataStorageRuleDao;

    @MockBean
    protected PipelineRunDao mockPipelineRunDao;

    @MockBean
    protected RestartRunDao mockRestartRunDao;

    @MockBean
    protected DtsSubmissionManager mockDtsSubmissionManager;

    @MockBean
    protected PipelineLauncher mockPipelineLauncher;

    @MockBean
    protected CommandBuilder mockCommandBuilder;

    @MockBean
    protected CredentialsManager mockCredentialsManager;

    @MockBean
    protected RunStatusDao mockRunStatusDao;

    @MockBean
    protected StopServerlessRunDao mockStopServerlessRunDao;

    @MockBean
    protected DockerContainerOperationManager mockDockerContainerOperationManager;

    @MockBean
    protected ContextualPreferenceDao mockContextualPreferenceDao;

    @MockBean
    protected ContextualPreferenceHandler mockContextualPreferenceHandler;

    @MockBean
    protected MonitoringNotificationDao mockMonitoringNotificationDao;

    @MockBean
    protected UserDao mockUserDao;

    @MockBean
    protected RoleDao mockRoleDao;

    @MockBean
    protected RunLogDao mockRunLogDao;

    @MockBean
    protected GroupStatusDao mockGroupStatusDao;

    @MockBean
    protected DataStorageValidator mockDataStorageValidator;

    @MockBean
    protected NotificationManager mockNotificationManager;

    @MockBean
    protected PipelineManager mockPipelineManager;

    @MockBean
    protected PipelineConfigurationManager mockPipelineConfigurationManager;

    @MockBean
    protected RestartRunManager mockRestartRunManager;

    @MockBean
    protected RunStatusManager mockRunStatusManager;

    @MockBean
    protected PipelineRunCRUDService mockPipelineRunCRUDService;

    @MockBean
    protected StopServerlessRunManager mockStopServerlessRunManager;

    @MockBean
    protected ServerlessConfigurationManager mockServerlessConfigurationManager;

    @MockBean
    protected ParameterMapper mockParameterMapper;

    @MockBean
    protected UserManager mockUserManager;

    @MockBean
    protected LustreFSManager mockLustreFSManager;

    @MockBean
    protected RunMountService mockRunMountService;

    @MockBean
    protected TemporaryCredentialsManager mockTemporaryCredentialsManager;

    @MockBean
    protected NodeScheduleManager nodeScheduleManager;

    @MockBean
    protected NodePoolManager nodePoolManager;

    @MockBean
    protected InfrastructureManager infrastructureManager;

    @MockBean
    protected PipelineRunDockerOperationManager pipelineRunDockerOperationManager;

    @MockBean
    protected DtsListingManager mockDtsListingManager;

    @MockBean
    protected CategoricalAttributeManager mockCategoricalAttributeManager;

    @MockBean
    protected MetadataDownloadManager mockMetadataDownloadManager;

    @MockBean
    protected UsersFileImportManager mockUsersFileImportManager;

    @MockBean
    protected JsonService mockJsonService;

    @MockBean
    protected DataStorageManager mockDataStorageManager;

    @MockBean
    protected FolderCrudManager mockFolderCrudManager;

    @MockBean
    protected RoleManager mockRoleManager;

    @MockBean
    protected DockerRegistryDao mockDockerRegistryDao;

    @MockBean
    protected DockerClientFactory mockDockerClientFactory;

    @MockBean
    protected CloudProfileCredentialsManagerProvider mockCloudProfileCredentialsManagerProvider;

    @MockBean
    protected OntologyManager mockOntologyManager;

    @SpyBean
    protected HierarchicalEntityManager spyHierarchicalEntityManager;

    @Bean
    protected FolderTemplateManager folderTemplateManager() {
        return new FolderTemplateManager();
    }

    @MockBean
    protected TemplatesScanner mockTemplatesScanner;

    @MockBean
    protected ToolScanInfoManager toolScanInfoManager;

    @MockBean
    protected PipelineRunKubernetesManager pipelineRunKubernetesManager;

    @MockBean
    protected UserRunnersManager mockUserRunnersManager;

    @MockBean
    protected PipelineRunAsManager mockPipelineRunAsManager;

    @MockBean
    protected EdgeServiceManager mockEdgeServiceManager;

    @MockBean
    protected NatGatewayManager natGatewayManager;

    @MockBean
    protected QuotaService mockQuotaService;

    @MockBean
    protected UsersUsageReportService usersUsageReportService;

    @MockBean
    protected OnlineUsersService onlineUsersService;

    @MockBean
    protected NgsPreprocessingManager preprocessingManager;

    @MockBean
    protected NodePoolUsageService nodePoolUsageService;

    @MockBean
    protected NodePoolReportService nodePoolReportService;

    @MockBean
    protected PipelineRepositoryService pipelineRepositoryService;

    @MockBean
    protected RunLimitsService runLimitsService;

    @Bean
    public GrantPermissionManager grantPermissionManager() {
        GrantPermissionManager grantPermissionManager = new GrantPermissionManager();
        grantPermissionManager.setAclService(mockAclService);
        grantPermissionManager.setAuthManager(mockAuthManager);
        grantPermissionManager.setEntityManager(mockEntityManager);
        grantPermissionManager.setIssueManager(mockIssueManager);
        grantPermissionManager.setMessageHelper(messageHelper);
        grantPermissionManager.setMetadataEntityManager(mockMetadataEntityManager);
        grantPermissionManager.setNodesManager(mockNodesManager);
        grantPermissionManager.setPermissionEvaluator(permissionEvaluator);
        grantPermissionManager.setPermissionFactory(permissionFactory);
        return spy(grantPermissionManager);
    }
}
