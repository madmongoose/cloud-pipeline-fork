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
package com.epam.pipeline.autotests.ao;

public enum Primitive {
    OK,
    CANCEL,
    COMMIT,
    PAUSE,
    RESUME,
    ENDPOINT,
    DELETE,
    REFRESH,
    RELOAD,
    EDIT_STORAGE,
    EDIT_FOLDER,
    UPLOAD,
    SELECT_ALL,
    CREATE_FOLDER,
    CREATE_PIPELINE,
    ADDRESS_BAR,
    CLEAR_SELECTION,
    REMOVE_ALL,
    EDIT,
    REGISTRY,
    DELETE_RUNTIME_FILES,
    STOP_PIPELINE,
    IMAGE_NAME,
    NAME,
    ALIAS,
    TYPE,
    VALUE,
    DELETE_ICON,
    ADD,
    ANOTHER_DOCKER_IMAGE,
    ANOTHER_COMPUTE_NODE,
    DOCKER_IMAGE_COMBOBOX,
    COMMAND,
    OUTPUT_ADD,
    INPUT_ADD,
    INPUT_PANEL,
    OUTPUT_PANEL,
    ADD_TASK,
    SAVE,
    REVERT,
    LAYOUT,
    FIT,
    SHOW_LINKS,
    ADD_SCATTER,
    PROPERTIES,
    ZOOM_IN,
    ZOOM_OUT,
    FULLSCREEN,
    STATUS,
    SSH_LINK,
    CREATE,
    CREATE_STORAGE,
    CREATE_NFS_MOUNT,
    CREATE_FILE,
    ADD_EXISTING_STORAGE,
    PATH,
    DESCRIPTION,
    REPOSITORY,
    TOKEN,
    EDIT_REPOSITORY_SETTINGS,
    EDIT_TASK,
    EDIT_WORKFLOW,
    MESSAGE,
    CLOSE,
    RENAME,
    NEW_FILE,
    RUN,
    ADD_NEW_RULE,
    TITLE,
    LABELS,
    PORT,
    LABEL_INPUT_FIELD,
    DEFAULT_COMMAND,
    CODE_TAB,
    CONFIGURATION_TAB,
    GRAPH_TAB,
    DOCUMENTS_TAB,
    HISTORY_TAB,
    CANVAS,
    DOWNLOAD,
    STORAGE_RULES_TAB,
    PIPELINE,
    VERSION,
    STARTED_TIME,
    COMPLETED_TIME,
    OWNER,
    STOP,
    LOG,
    RERUN,
    FILE_MASK,
    MOVE_TO_STS,
    RUN_NAME,
    PERMISSIONS,
    INFO,
    USER_NAME,
    PASSWORD,
    CERTIFICATE,
    EDIT_CREDENTIALS,
    STORAGEPATH,
    HEADER,
    NAVIGATION,
    STS_DURATION,
    LTS_DURATION,
    ENABLE_VERSIONING,
    BACKUP_DURATION,
    MOUNT_POINT,
    MOUNT_OPTIONS,
    UNREGISTER,
    SHOW_METADATA,
    HIDE_METADATA,
    UPLOAD_METADATA,
    ADD_KEY,
    REMOVE_ALL_KEYS,
    KEY_FIELD,
    KEY_FIELD_INPUT,
    VALUE_FIELD,
    VALUE_FIELD_INPUT,
    INFO_TAB,
    PARAMETER_NAME,
    PARAMETER_PATH,
    PARAMETER_VALUE,
    REMOVE_PARAMETER,
    BUCKET_PANEL,
    FILES_PANEL,
    CROSS,
    CONFIGURATION,
    ESTIMATE_PRICE,
    INSTANCE,
    EXEC_ENVIRONMENT,
    PARAMETERS,
    ADD_PARAMETER,
    ADD_CONFIGURATION,
    DISK,
    TIMEOUT,
    TEMPLATE,
    SET_AS_DEFAULT,
    RELEASE,
    CONFIRM_RELEASE,
    LAUNCH_CLUSTER,
    CLUSTER_DIALOG,
    WORKING_NODES,
    NEXT_PAGE,
    PREV_PAGE,
    UPDATE_CONFIGURATION,
    FIRST_VERSION,
    ADVANCED_PANEL,
    PARAMETERS_PANEL,
    BODY,
    GROUP,
    REGISTRIES_LIST,
    GROUPS_LIST,
    SETTINGS,
    REGISTRY_SETTINGS,
    GROUP_SETTINGS,
    CREATE_REGISTRY,
    EDIT_REGISTRY,
    BACK_TO_GROUP,
    RUN_DROPDOWN,
    DEFAULT_SETTINGS,
    CUSTOM_SETTINGS,
    TOOL_MENU,
    ENABLE_TOOL,
    IMAGE,
    ENABLE,
    SEARCH,
    SEARCH_INPUT,
    CREATE_PERSONAL_GROUP,
    GROUPS_SEARCH,
    CLI_TAB,
    SYSTEM_EVENTS_TAB,
    USER_MANAGEMENT_TAB,
    PREFERENCES_TAB,
    SYSTEM_LOGS_TAB,
    NAT_GATEWAY_TAB,
    USERS_TAB,
    ROLE_TAB,
    GROUPS_TAB,
    CLUSTER_TAB,
    SYSTEM_TAB,
    DOCKER_SECURITY_TAB,
    AUTOSCALING_TAB,
    USER_INTERFACE_TAB,
    LUSTRE_FS_TAB,
    LAUNCH_TAB,
    TABLE,
    EDIT_GROUP,
    DELETE_GROUP,
    SHORT_DESCRIPTION,
    FULL_DESCRIPTION,
    CREATE_GROUP,
    CREATE_USER,
    CREATE_PERSONAL_GROUP_FROM_SETTINGS,
    VERSIONS,
    PRICE_TYPE,
    IP,
    TOOL_SETTINGS,
    INSTANCE_TYPE,
    NEW_ENDPOINT,
    SEVERITY,
    STATE,
    STATE_CHECKBOX,
    TITLE_FIELD,
    BODY_FIELD,
    SEVERITY_COMBOBOX,
    ACTIVE_LABEL,
    WARNING,
    CRITICAL,
    EXPAND,
    NARROW,
    DATE,
    SEVERITY_ICON,
    ENLARGE,
    FILE_PREVIEW,
    VIEW_AS_TEXT,
    CREATE_CONFIGURATION,
    TREE,
    FOLDERS,
    START_IDLE,
    AUTO_PAUSE,
    LAUNCH,
    ESTIMATED_PRICE,
    INFORMATION_ICON,
    PRICE_TABLE,
    ARROW,
    PIPELINES,
    RUNS,
    TOOLS,
    DATA,
    ISSUES,
    QUESTION_MARK,
    SEARCH_RESULT,
    NEW_ISSUE,
    WRITE_TAB,
    PREVIEW_TAB,
    PREVIEW,
    HIGHLIGHTS,
    TAGS,
    ATTRIBUTES,
    ADD_SYSTEM_PARAMETER,
    NESTED_RUNS,
    WORKERS_PRICE_TYPE,
    DEFAULT_CHILD_NODES,
    RESET,
    CONTAINER_LOGS,
    BLOCK,
    UNBLOCK,
    APPLY,
    PIPE_CLI,
    GIT_CLI,
    GIT_COMMAND,
    SHARE_WITH,
    ADD_USER,
    ADD_GROUP,
    EMAIL_NOTIFICATIONS_TAB,
    CLOUD_REGIONS_TAB,
    EXPORT_USERS,
    RUN_CAPABILITIES,
    LIMIT_MOUNTS,
    SELECT_ALL_NON_SENSITIVE,
    SENSITIVE_STORAGE,
    ALL_PIPELINES,
    ALL_STORAGES,
    CLOUD_REGION,
    FRIENDLY_URL,
    SERVICES,
    NODE_IMAGE,
    GIT_REPOSITORY,
    ADD_INSTANCE,
    DO_NOT_MOUNT_STORAGES,
    LAUNCH_COMMANDS,
    CONFIGURE,
    GENERATE_URL,
    IMPERSONATE,
    MY_PROFILE,
    FILE_SYSTEM_ACCESS,
    DISABLE,
    ALLOW_COMMIT,
    CONTENT_PREVIEW,
    ADD_ROUTE,
    ROUTE_TABLE,
    ADD_PORT,
    SERVER_NAME,
    COMMENT,
    SPECIFY_IP,
    RESOLVE,
    DISABLE_MOUNT,
    ALLOW_MOUNT,
    SERVICE_NAME,
    CONFIGURE_DNS,
    POOL_NAME,
    STARTS_ON,
    STARTS_ON_TIME,
    ENDS_ON,
    ENDS_ON_TIME,
    AUTOSCALED
}
