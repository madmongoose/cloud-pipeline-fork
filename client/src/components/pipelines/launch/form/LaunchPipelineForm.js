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

import React from 'react';
import PropTypes from 'prop-types';
import {inject, observer} from 'mobx-react';
import classNames from 'classnames';
import {action, computed, observable} from 'mobx';
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Collapse,
  Form,
  Icon,
  Input,
  message,
  Modal,
  Popover,
  Row,
  Select,
  Spin
} from 'antd';
import styles from './LaunchPipelineForm.css';
import Menu, {MenuItem} from 'rc-menu';
import Dropdown from 'rc-dropdown';
import BucketBrowser from './../dialogs/BucketBrowser';
import PipelineBrowser from './../dialogs/PipelineBrowser';
import DockerImageInput from './DockerImageInput';
import BooleanParameterInput from './BooleanParameterInput';
import MetadataBrowser from './../dialogs/MetadataBrowser';
import CodeEditor from '../../../special/CodeEditor';
import JobEstimatedPriceInfo from '../../../special/job-estimated-price-info';
import AWSRegionTag from '../../../special/AWSRegionTag';
import AutoCompleteForParameter from '../../../special/AutoCompleteForParameter';
import {LimitMountsInput} from './LimitMountsInput';
import RunName from '../../../runs/run-name';

import PipelineRunEstimatedPrice from '../../../../models/pipelines/PipelineRunEstimatedPrice';
import FolderProject from '../../../../models/folders/FolderProject';
import MetadataEntityFields from '../../../../models/folderMetadata/MetadataEntityFields';
import ToolDefaultCommand from '../../../../models/tools/ToolDefaultCommand';

import roleModel from '../../../../utils/roleModel';
import SystemParametersBrowser from '../dialogs/SystemParametersBrowser';
import localization from '../../../../utils/localization';

import hints from './hints';
import FireCloudMethodSnapshotConfigurationsRequest
  from '../../../../models/firecloud/FireCloudMethodSnapshotConfigurations';
import FireCloudMethodParameters
  from '../../../../models/firecloud/FireCloudMethodParameters';
import LoadingView from '../../../special/LoadingView';
import {getSpotTypeName} from '../../../special/spot-instance-names';
import DTSClusterInfo from '../../../../models/dts/DTSClusterInfo';
import {
  autoScaledClusterEnabled,
  hybridAutoScaledClusterEnabled,
  ConfigureClusterDialog,
  getSkippedSystemParametersList,
  getSystemParameterDisabledState,
  gridEngineEnabled,
  sparkEnabled,
  slurmEnabled,
  kubeEnabled,
  setClusterParameterValue,
  getAutoScaledPriceTypeValue
} from './utilities/launch-cluster';
import checkModifiedState from './utilities/launch-form-modified-state';
import {
  ADVANCED,
  EXEC_ENVIRONMENT,
  PARAMETERS,
  SYSTEM_PARAMETERS
} from './utilities/launch-form-sections';
import * as prettyUrlGenerator from './utilities/pretty-url';
import * as parameterUtilities from './utilities/parameter-utilities';
import RunSchedulingList from '../../../runs/run-scheduling/run-sheduling-list';
import pipelinesEquals from './utilities/pipelines-equals';
import LaunchCommand from './utilities/launch-command';
import {names} from '../../../../models/utils/ContextualPreference';
import {
  SubmitButton,
  getInputPaths,
  getOutputPaths
} from '../../../runs/actions';
import LoadToolVersionSettings from '../../../../models/tools/LoadToolVersionSettings';
import ServerlessAPIButton from '../../../special/serverless-api-button';
import RunCapabilities, {
  addCapability,
  applyCapabilities,
  getEnabledCapabilities,
  hasPlatformSpecificCapabilities,
  isCustomCapability,
  RUN_CAPABILITIES
} from './utilities/run-capabilities';
import {
  CP_CAP_LIMIT_MOUNTS,
  CP_CAP_SGE,
  CP_CAP_SPARK,
  CP_CAP_SLURM,
  CP_CAP_KUBE,
  CP_CAP_DIND_CONTAINER,
  CP_CAP_SYSTEMD_CONTAINER,
  CP_CAP_AUTOSCALE,
  CP_CAP_AUTOSCALE_WORKERS,
  CP_CAP_AUTOSCALE_HYBRID,
  CP_CAP_AUTOSCALE_PRICE_TYPE
} from './utilities/parameters';
import OOMCheck from './utilities/oom-check';
import AllowedInstancesCountWarning from
  './utilities/allowed-instances-count-warning';
import HostedAppConfiguration from '../dialogs/HostedAppConfiguration';
import JobNotifications from '../dialogs/job-notifications';
import {withCurrentUserAttributes} from '../../../../utils/current-user-attributes';
import {
  applyParameters as applyGPUScalingParameters,
  readGPUScalingPreference
} from './utilities/enable-gpu-scaling';

const FormItem = Form.Item;
const RUN_SELECTED_KEY = 'run selected';
const RUN_CLUSTER_KEY = 'run cluster';

const CLOUD_PLATFORM_ENVIRONMENT = 'CLOUD_PLATFORM';
const FIRE_CLOUD_ENVIRONMENT = 'FIRECLOUD';
const DTS_ENVIRONMENT = 'DTS';

const OTHER_PARAMETERS_GROUP = 'other';

function getFormItemClassName (rootClass, key) {
  if (key) {
    return `${rootClass} ${key.replace(/\./g, '_')}`;
  }
  return rootClass;
}

@inject(
  'runDefaultParameters',
  'googleApi',
  'awsRegions',
  'dtsList',
  'preferences',
  'dockerRegistries',
  'dataStorageAvailable'
)
@localization.localizedComponent
@roleModel.authenticationInfo
@withCurrentUserAttributes()
@observer
class LaunchPipelineForm extends localization.LocalizedReactComponent {
  localizedStringWithSpotDictionaryFn = (key) => {
    return this.localizedString(
      key,
      [
        {key: 'spot', value: getSpotTypeName(true, this.currentCloudRegionProvider)},
        {key: 'on-demand', value: getSpotTypeName(false, this.currentCloudRegionProvider)},
        {key: 'on demand', value: getSpotTypeName(false, this.currentCloudRegionProvider)}
      ]
    );
  };

  isDts = (props = this.props) => {
    if (!this.props.detached) {
      return false;
    }
    const [currentConfiguration] = props.configurations
      .filter(config => config.name === props.currentConfigurationName);

    return currentConfiguration && currentConfiguration.executionEnvironment === DTS_ENVIRONMENT;
  };

  currentUserName = () => {
    if (!this.props.authenticatedUserInfo.loaded) {
      return undefined;
    }
    return this.props.authenticatedUserInfo.value.userName;
  };

  friendlyUrlAvailable = () => {
    if (!this.props.authenticatedUserInfo.loaded) {
      return false;
    }
    const {
      admin,
      roles = []
    } = this.props.authenticatedUserInfo.value;
    return admin || roles.find(r => /^ROLE_ADVANCED_USER$/i.test(r.name));
  };

  static propTypes = {
    pipeline: PropTypes.shape(),
    pipelines: PropTypes.array,
    version: PropTypes.string,
    pipelineConfiguration: PropTypes.string,
    allowedInstanceTypes: PropTypes.object,
    instanceTypes: PropTypes.string,
    toolInstanceTypes: PropTypes.string,
    parameters: PropTypes.shape(),
    configurations: PropTypes.array,
    onLaunch: PropTypes.func,
    alerts: PropTypes.arrayOf(PropTypes.shape({
      message: PropTypes.string,
      type: PropTypes.string
    })),
    editConfigurationMode: PropTypes.bool,
    onConfigurationChanged: PropTypes.func,
    currentConfigurationName: PropTypes.string,
    currentConfigurationIsDefault: PropTypes.bool,
    onSetConfigurationAsDefault: PropTypes.func,
    onRemoveConfiguration: PropTypes.func,
    readOnly: PropTypes.bool,
    canExecute: PropTypes.bool,
    canRunCluster: PropTypes.bool,
    canRemove: PropTypes.bool,
    detached: PropTypes.bool,
    runConfiguration: PropTypes.func,
    runConfigurationId: PropTypes.string,
    runConfigurationCluster: PropTypes.func,
    onSelectPipeline: PropTypes.func,
    defaultPriceTypeIsSpot: PropTypes.bool,
    defaultPriceTypeIsLoading: PropTypes.bool,
    isDetachedConfiguration: PropTypes.bool,
    configurationId: PropTypes.string,
    selectedPipelineParametersIsLoading: PropTypes.bool,
    fireCloudMethod: PropTypes.shape({
      name: PropTypes.string,
      namespace: PropTypes.string,
      snapshot: PropTypes.string,
      configuration: PropTypes.string,
      configurationSnapshot: PropTypes.string
    }),
    onInitialized: PropTypes.func,
    onModified: PropTypes.func
  };

  static defaultProps = {
    instanceTypes: names.allowedInstanceTypes,
    toolInstanceTypes: names.allowedToolInstanceTypes
  };

  state = {
    openedPanels: [PARAMETERS],
    isDts: this.isDts(),
    execEnvSelectValue: null,
    dtsId: null,
    startIdle: false,
    useDefaultCmd: false,
    pipelineBrowserVisible: false,
    dockerImageBrowserVisible: false,
    pipeline: null,
    version: null,
    pipelineConfiguration: null,
    launchCluster: false,
    autoScaledCluster: false,
    hybridAutoScaledClusterEnabled: false,
    gpuScalingConfiguration: undefined,
    gridEngineEnabled: false,
    sparkEnabled: false,
    slurmEnabled: false,
    kubeEnabled: false,
    autoScaledPriceType: undefined,
    nodesCount: 0,
    maxNodesCount: 0,
    configureClusterDialogVisible: false,
    scheduleRules: null,
    bucketBrowserVisible: false,
    bucketPath: null,
    bucketPathParameterKey: null,
    bucketPathParameterSection: null,
    currentMetadataEntity: [],
    rootEntityId: null,
    filteredEntityFields: [],
    activeAutoCompleteParameterKey: null,
    currentProjectMetadata: null,
    estimatedPrice: {
      evaluated: false,
      pending: false,
      pricePerHour: 0,
      maximumPrice: 0,
      averagePrice: 0,
      minimumPrice: 0
    },
    validation: {
      [EXEC_ENVIRONMENT]: {
        coresNumber: {
          result: 'success',
          message: null
        }
      }
    },
    currentProjectId: null,
    currentLaunchKey: null,
    showOnlyFolderInBucketBrowser: false,
    systemParameterBrowserVisible: false,
    systemParameters: [],
    fireCloudMethodName: (this.props.fireCloudMethod &&
      this.props.fireCloudMethod.name) || null,
    fireCloudMethodNamespace: (this.props.fireCloudMethod &&
      this.props.fireCloudMethod.namespace) || null,
    fireCloudMethodSnapshot: (this.props.fireCloudMethod &&
      this.props.fireCloudMethod.snapshot) || null,
    fireCloudMethodConfiguration: (this.props.fireCloudMethod &&
      this.props.fireCloudMethod.configuration) || null,
    fireCloudMethodConfigurationSnapshot: (this.props.fireCloudMethod &&
      this.props.fireCloudMethod.configurationSnapshot) || null,
    fireCloudInputs: {},
    fireCloudOutputs: {},
    fireCloudInputsErrors: {},
    fireCloudOutputsErrors: {},
    fireCloudDefaultInputs: (
      this.props.fireCloudMethod &&
      this.props.fireCloudMethod.methodInputs
    ) || [],
    fireCloudDefaultOutputs: (
      this.props.fireCloudMethod &&
      this.props.fireCloudMethod.methodOutputs
    ) || [],
    autoPause: true,
    showLaunchCommands: false,
    runCapabilities: [],
    useResolvedParameters: false,
    notifications: [],
    runNameAlias: undefined
  };

  formItemLayout = {
    labelCol: {
      className: styles.formItemLabelColumn
    },
    wrapperCol: {
      className: styles.formItemWrapperColumn
    }
  };

  leftFormItemLayout = {
    labelCol: {
      xs: {span: 24},
      sm: {span: 5},
      md: {span: 4},
      lg: {span: 3},
      xl: {span: 2}
    },
    wrapperCol: {
      xs: {span: 24},
      sm: {span: 16},
      md: {span: 15},
      lg: {span: 15},
      xl: {span: 10}
    }
  };

  parameterItemLayout = {
    wrapperCol: {
      xs: {span: 24}
    }
  };

  cmdTemplateFormItemLayout = {
    labelCol: {
      xs: {span: 24},
      sm: {span: 5},
      md: {span: 4},
      lg: {span: 3},
      xl: {span: 2}
    },
    wrapperCol: {
      xs: {span: 24},
      sm: {span: 19},
      md: {span: 20},
      lg: {span: 21},
      xl: {span: 22}
    }
  };

  prevParameters = {};

  @observable modified = false;
  @observable inputPaths = [];
  @observable outputPaths = [];
  @observable dockerImage = null;
  @observable cmdTemplateValue;
  @observable launchCommandPayload;
  @observable _toolSettings;
  @observable toolDefaultCmd;
  @observable regionDisabledByToolSettings = false;
  @observable toolCloudRegion = null;
  @observable toolPlatform = null;
  @observable toolAllowSensitive = true;

  @action
  formFieldsChanged = async () => {
    const {form, parameters} = this.props;
    const formParameters = form.getFieldValue(PARAMETERS);
    const formParametersCorrected = parameterUtilities.correctFormFieldValues(formParameters);
    if (formParametersCorrected) {
      form.setFieldsValue({
        [PARAMETERS]: formParameters
      });
    }
    this.inputPaths = getInputPaths(
      formParameters,
      (parameters || {}).parameters
    );
    this.outputPaths = getOutputPaths(
      formParameters,
      (parameters || {}).parameters
    );
    const currentDockerImage = form.getFieldValue(`${EXEC_ENVIRONMENT}.dockerImage`);
    if (this.dockerImage !== currentDockerImage) {
      if (currentDockerImage) {
        await this.loadToolSettings(currentDockerImage);
        const currentValue = this.props.form.getFieldValue(`${EXEC_ENVIRONMENT}.cloudRegionId`);
        const regionId = this.correctCloudRegion(
          currentValue ||
          this.defaultCloudRegionId
        );
        this.props.form.setFieldsValue({
          [`${EXEC_ENVIRONMENT}.cloudRegionId`]: this.toolCloudRegion || regionId
        });
      } else {
        this.resetToolSettings();
      }
    }
    this.dockerImage = currentDockerImage || this.getDefaultValue('docker_image');
    this.modified = checkModifiedState(
      this.props,
      this.state,
      {
        defaultCloudRegionId: this.defaultCloudRegionId,
        execEnvSelectValue: this.getExecEnvSelectValue().execEnvSelectValue,
        spotInitialValue: this.correctPriceTypeValue(this.getDefaultValue('is_spot')),
        cmdTemplateValue: this.cmdTemplateValue,
        toolDefaultCmd: this.toolDefaultCmd
      }
    );
    this.props.onModified && this.props.onModified(this.modified);
    this.rebuildLaunchCommand();
    if (this.forceValidation) {
      this.forceValidation = false;
      this.props.form.validateFields(undefined, {force: true}, () => {});
    } else {
      this.props.form.validateFields();
    }
  };

  rebuildLaunchCommand = () => {
    if (!this.props.detached && !this.props.editConfigurationMode) {
      this.props.form.validateFields(async (err, values) => {
        if (!err && this.validateFireCloudConnections()) {
          this.launchCommandPayload = this.generateLaunchPayload(values);
        } else {
          this.launchCommandPayload = undefined;
        }
      });
    }
  };

  showLaunchCommands = () => {
    this.setState({showLaunchCommands: true});
  };

  hideLaunchCommands = () => {
    this.setState({showLaunchCommands: false});
  };

  get hyperThreadingDisabled () {
    return (this.state.runCapabilities || [])
      .indexOf(RUN_CAPABILITIES.disableHyperThreading) >= 0;
  }

  @computed
  get isWindowsPlatform () {
    return /^windows$/i.test(this.toolPlatform);
  }

  onRunCapabilitiesSelect = (capabilities) => {
    this.setState({
      runCapabilities: (capabilities || []).slice()
    }, this.formFieldsChanged);
  };

  renderAdditionalRunCapabilities = () => {
    if (hasPlatformSpecificCapabilities(this.toolPlatform, this.props.preferences)) {
      return (
        <FormItem
          className={getFormItemClassName(styles.formItem, 'runCapabilities')}
          {...this.formItemLayout}
          label="Run capabilities"
          hasFeedback
        >
          <RunCapabilities
            values={this.state.runCapabilities}
            onChange={this.onRunCapabilitiesSelect}
            platform={this.toolPlatform}
            dockerImage={this.props.form.getFieldValue(`${EXEC_ENVIRONMENT}.dockerImage`)}
            provider={this.currentCloudRegionProvider}
          />
        </FormItem>
      );
    }
  }

  @observable
  _fireCloudConfigurations = null;
  @observable
  _fireCloudParameters = null;

  @computed
  get isFireCloudSelected () {
    return !!(this.state.fireCloudMethodName && this.state.fireCloudMethodNamespace &&
      this.state.fireCloudMethodSnapshot);
  }

  @computed
  get selectedFireCloudConfiguration () {
    if (this.isFireCloudSelected &&
      this._fireCloudConfigurations && this._fireCloudConfigurations.loaded) {
      return (this._fireCloudConfigurations.value || []).filter(
        config =>
          config.name === this.state.fireCloudMethodConfiguration &&
          config.snapshotId === this.state.fireCloudMethodConfigurationSnapshot
      )[0];
    }
    return null;
  }

  @computed
  get selectedFireCloudParameters () {
    if (this.isFireCloudSelected &&
      this._fireCloudParameters && this._fireCloudParameters.loaded) {
      return this._fireCloudParameters.value;
    }
    return null;
  }

  loadFireCloudConfigurations = () => {
    if (this.state.fireCloudMethodNamespace && this.state.fireCloudMethodName &&
      this.state.fireCloudMethodSnapshot) {
      if (!this.state.fireCloudDefaultInputs || this.state.fireCloudDefaultInputs.length === 0 ||
        !this.state.fireCloudDefaultOutputs || this.state.fireCloudDefaultOutputs.length === 0) {
        this._fireCloudConfigurations = new FireCloudMethodSnapshotConfigurationsRequest(
          this.props.googleApi,
          this.state.fireCloudMethodNamespace,
          this.state.fireCloudMethodName,
          this.state.fireCloudMethodSnapshot
        );
      } else {
        this._fireCloudConfigurations = null;
      }
      this._fireCloudParameters = new FireCloudMethodParameters(
        this.props.googleApi,
        this.state.fireCloudMethodNamespace,
        this.state.fireCloudMethodName,
        this.state.fireCloudMethodSnapshot
      );
    }
  };

  getFireCloudDefaultInputs = () => {
    if (this.state.fireCloudDefaultInputs && this.state.fireCloudDefaultInputs.length > 0) {
      const obj = {};
      for (let i = 0; i < this.state.fireCloudDefaultInputs.length; i++) {
        const param = this.state.fireCloudDefaultInputs[i];
        obj[param.name] = param.value;
      }
      return obj;
    } else if (this.selectedFireCloudConfiguration &&
      this.selectedFireCloudConfiguration.payloadObject) {
      return this.selectedFireCloudConfiguration.payloadObject.inputs || {};
    }
    return {};
  };

  getFireCloudDefaultOutputs = () => {
    if (this.state.fireCloudDefaultOutputs && this.state.fireCloudDefaultOutputs.length > 0) {
      const obj = {};
      for (let i = 0; i < this.state.fireCloudDefaultOutputs.length; i++) {
        const param = this.state.fireCloudDefaultOutputs[i];
        obj[param.name] = param.value;
      }
      return obj;
    } else if (this.selectedFireCloudConfiguration &&
      this.selectedFireCloudConfiguration.payloadObject) {
      return this.selectedFireCloudConfiguration.payloadObject.outputs || {};
    }
    return {};
  };

  validateFireCloudConnections = () => {
    if (this.props.detached &&
      this.state.fireCloudMethodName &&
      this.state.fireCloudMethodNamespace &&
      this.state.fireCloudMethodSnapshot &&
      this.selectedFireCloudParameters) {
      const inputs = (this.selectedFireCloudParameters.inputs || []).map(i => i);
      const outputs = (this.selectedFireCloudParameters.outputs || []).map(o => o);
      const defaultInputs = this.getFireCloudDefaultInputs();
      const defaultOutputs = this.getFireCloudDefaultOutputs();
      const inputsValues = this.state.fireCloudInputs;
      const outputsValues = this.state.fireCloudOutputs;
      let validationFailed = false;
      const validateParameters = (params, defaultParams, values) => {
        const validationObj = {};
        for (let i = 0; i < params.length; i++) {
          const value = values[params[i].name] === undefined
            ? defaultParams[params[i].name]
            : values[params[i].name];
          if (!value && !params[i].optional) {
            validationObj[params[i].name] = 'This field is required';
            validationFailed = true;
          } else if (value) {
            switch ((params[i].inputType || params[i].outputType || '').toLowerCase()) {
              case 'int':
              case 'int?':
                if (isNaN(value) || +value !== Math.round(+value)) {
                  validationObj[params[i].name] = 'This field should be integer';
                }
                break;
            }
          }
        }
        return validationObj;
      };
      const inputsValidation = validateParameters(inputs, defaultInputs, inputsValues);
      const outputsValidation = validateParameters(outputs, defaultOutputs, outputsValues);
      this.setState({
        fireCloudInputsErrors: inputsValidation,
        fireCloudOutputsErrors: outputsValidation
      });
      return !validationFailed;
    }
    return true;
  };

  getFireCloudConnections = () => {
    if (this.props.detached &&
      this.state.fireCloudMethodName &&
      this.state.fireCloudMethodNamespace &&
      this.state.fireCloudMethodSnapshot &&
      this.selectedFireCloudParameters) {
      const inputs = (this.selectedFireCloudParameters.inputs || []).map(i => i);
      const outputs = (this.selectedFireCloudParameters.outputs || []).map(o => o);
      const defaultInputs = this.getFireCloudDefaultInputs();
      const defaultOutputs = this.getFireCloudDefaultOutputs();
      const inputsValues = this.state.fireCloudInputs;
      const outputsValues = this.state.fireCloudOutputs;
      const getParameters = (params, defaultParams, values) => {
        const result = [];
        for (let i = 0; i < params.length; i++) {
          const value = values[params[i].name] === undefined
            ? defaultParams[params[i].name]
            : values[params[i].name];
          if (value) {
            result.push({
              name: params[i].name,
              type: params[i].inputType || params[i].outputType,
              optional: params[i].optional,
              value
            });
          }
        }
        return result;
      };
      const methodInputs = getParameters(inputs, defaultInputs, inputsValues);
      const methodOutputs = getParameters(outputs, defaultOutputs, outputsValues);
      return {
        methodInputs,
        methodOutputs
      };
    }
    return null;
  };

  @computed
  get dtsList () {
    if (this.props.dtsList.loaded) {
      return (this.props.dtsList.value || []).filter(dts => dts.schedulable === true).map(i => i);
    }
    return [];
  }

  @computed
  get awsRegions () {
    if (this.props.awsRegions.loaded) {
      return (this.props.awsRegions.value || []).map(r => r);
    }
    return [];
  }

  @computed
  get defaultCloudRegionId () {
    const [defaultRegion] = this.awsRegions.filter(r => r.default);
    if (defaultRegion) {
      return `${defaultRegion.id}`;
    }
    return null;
  }

  @computed
  get currentCloudRegion () {
    const formValue = this.getSectionFieldValue(EXEC_ENVIRONMENT)('cloudRegionId') ||
      this.getDefaultValue('cloudRegionId') || this.defaultCloudRegionId;
    return this.awsRegions.filter(r => `${r.id}` === `${formValue}`)[0];
  }

  @computed
  get currentCloudRegionId () {
    if (this.currentCloudRegion) {
      return this.currentCloudRegion.id;
    }
    return null;
  }

  @computed
  get currentCloudRegionProvider () {
    if (this.currentCloudRegion) {
      return this.currentCloudRegion.provider;
    }
    return null;
  }

  handleSubmit = (e) => {
    e.preventDefault();
    this.props.form.validateFields(async (err, values) => {
      if (!err && this.validateFireCloudConnections()) {
        let payload;
        if (this.props.editConfigurationMode) {
          payload = this.generateConfigurationPayload(values);
        } else {
          payload = this.generateLaunchPayload(values);
        }
        if (this.props.onLaunch) {
          const result = await this.props.onLaunch(
            payload,
            values[ADVANCED].hostedApplication,
            this.toolPlatform,
            this.props.parameters.run_as &&
            this.currentUserName() !== this.props.parameters.run_as
          );
          if (result) {
            this.reset();
            this.prepare();
            this.forceValidation = true;
            this.formFieldsChanged();
          }
        }
      } else {
        const openedPanels = this.state.openedPanels;
        const getPanelKey = (key) => key === SYSTEM_PARAMETERS ? ADVANCED : key;
        const wrongFields = [];
        const extractFields = (section) => {
          if (section === ADVANCED || section === EXEC_ENVIRONMENT) {
            for (let key in err[section]) {
              if (err[section].hasOwnProperty(key)) {
                wrongFields.push(key.replace(/\./g, '_'));
              }
            }
          } else if (section === PARAMETERS || section === SYSTEM_PARAMETERS) {
            for (let key in err[section].params) {
              if (err[section].params.hasOwnProperty(key)) {
                wrongFields.push(key.replace(/\./g, '_'));
              }
            }
          }
        };
        for (let key in err) {
          if (err.hasOwnProperty(key)) {
            extractFields(key);
            if (openedPanels.indexOf(getPanelKey(key)) === -1) {
              openedPanels.push(getPanelKey(key));
            }
          }
        }
        this.setState({
          openedPanels
        }, () => {
          if (wrongFields.length > 0) {
            const scrollToWrongField = () => {
              const element = document.querySelector(`.${wrongFields[0]}`);
              const layout = document.querySelector(`.${styles.layout}`);
              const scrollableParent = layout.parentElement.parentElement;
              if (scrollableParent && element) {
                // For detached configuration & pipeline configuration scrolling:
                scrollableParent.scrollTo({left: 0, top: element.offsetTop});
                if (scrollableParent.parentElement) {
                  // For launch form scrolling:
                  scrollableParent.parentElement.scrollTo({left: 0, top: element.offsetTop});
                }
              }
            };
            const TIMEOUT_MS = 500;
            setTimeout(scrollToWrongField, TIMEOUT_MS);
          }
        });
      }
    });
  };

  run = ({key}, entitiesIds, metadataClass, expansionExpression, folderId) => {
    this.props.form.validateFields((err, values) => {
      if (!err && this.validateFireCloudConnections()) {
        const payload = this.generateConfigurationPayload(values);
        switch (key) {
          case RUN_SELECTED_KEY:
            if (this.props.runConfiguration) {
              if (this.props.isDetachedConfiguration) {
                this.props.runConfiguration(
                  payload,
                  entitiesIds,
                  metadataClass,
                  expansionExpression,
                  folderId
                );
              } else {
                this.props.runConfiguration(payload);
              }
            }
            break;
          case RUN_CLUSTER_KEY:
            if (this.props.isDetachedConfiguration) {
              this.props.runConfigurationCluster(
                payload,
                entitiesIds,
                metadataClass,
                expansionExpression,
                folderId
              );
            } else {
              this.props.runConfigurationCluster(payload);
            }
            break;
        }
      }
    });
  };

  getExecEnvSelectValue = () => {
    if (!this.props.detached) {
      return {
        execEnvSelectValue: null,
        dtsId: null
      };
    }
    let execEnvSelectValue;
    let dtsId;
    const [currentConfiguration] = this.props.configurations
      .filter(config => config.name === this.props.currentConfigurationName);

    if (this.isFireCloudSelected) {
      execEnvSelectValue = FIRE_CLOUD_ENVIRONMENT;
    } else if (currentConfiguration &&
      currentConfiguration.executionEnvironment === DTS_ENVIRONMENT) {
      dtsId = this.state.dtsId || currentConfiguration.dtsId;
      execEnvSelectValue = `${DTS_ENVIRONMENT}.${dtsId}`;
    } else {
      execEnvSelectValue = CLOUD_PLATFORM_ENVIRONMENT;
    }

    return {execEnvSelectValue, dtsId};
  };

  resetState = (keepPipeline) => {
    const {execEnvSelectValue, dtsId} = this.getExecEnvSelectValue();
    const autoScaledCluster = autoScaledClusterEnabled(this.props.parameters.parameters);
    const hybridAutoScaledCluster = hybridAutoScaledClusterEnabled(
      this.props.parameters.parameters
    );
    const gpuScalingConfiguration = readGPUScalingPreference(
      {
        autoScaled: autoScaledCluster,
        provider: this.currentCloudRegionProvider,
        hybrid: hybridAutoScaledCluster,
        parameters: this.props.parameters.parameters
      },
      this.props.preferences
    );
    const gridEngineEnabledValue = gridEngineEnabled(this.props.parameters.parameters);
    const sparkEnabledValue = sparkEnabled(this.props.parameters.parameters);
    const slurmEnabledValue = slurmEnabled(this.props.parameters.parameters);
    const kubeEnabledValue = kubeEnabled(this.props.parameters.parameters);
    const autoScaledPriceTypeValue = getAutoScaledPriceTypeValue(this.props.parameters.parameters);
    const runCapabilities = getEnabledCapabilities(this.props.parameters.parameters);
    if (keepPipeline) {
      this.setState({
        openedPanels: this.getDefaultOpenedPanels(),
        startIdle: this.props.parameters.cmd_template === 'sleep infinity',
        useDefaultCmd: false,
        isDts: this.isDts(),
        execEnvSelectValue,
        dtsId,
        pipelineBrowserVisible: false,
        dockerImageBrowserVisible: false,
        launchCluster: +this.props.parameters.node_count > 0 || autoScaledCluster,
        autoScaledCluster: autoScaledCluster,
        hybridAutoScaledClusterEnabled: hybridAutoScaledCluster,
        gpuScalingConfiguration,
        gridEngineEnabled: gridEngineEnabledValue,
        sparkEnabled: sparkEnabledValue,
        slurmEnabled: slurmEnabledValue,
        kubeEnabled: kubeEnabledValue,
        autoScaledPriceType: autoScaledPriceTypeValue,
        runCapabilities,
        scheduleRules: null,
        nodesCount: +this.props.parameters.node_count,
        maxNodesCount: this.props.parameters.parameters &&
        this.props.parameters.parameters[CP_CAP_AUTOSCALE_WORKERS]
          ? +this.props.parameters.parameters[CP_CAP_AUTOSCALE_WORKERS].value
          : 0,
        bucketBrowserVisible: false,
        bucketPath: null,
        bucketPathParameterKey: null,
        bucketPathParameterSection: null,
        estimatedPrice: {
          evaluated: false,
          pending: false,
          pricePerHour: 0,
          maximumPrice: 0,
          averagePrice: 0,
          minimumPrice: 0
        },
        validation: {
          [EXEC_ENVIRONMENT]: {
            coresNumber: {
              result: 'success',
              message: null
            }
          }
        },
        fireCloudInputs: {},
        fireCloudOutputs: {},
        fireCloudInputsErrors: {},
        fireCloudOutputsErrors: {}
      }, () => {
        this.forceValidation = true;
        this.formFieldsChanged();
      });
    } else {
      this.setState({
        openedPanels: this.getDefaultOpenedPanels(),
        startIdle: this.props.parameters.cmd_template === 'sleep infinity',
        useDefaultCmd: false,
        isDts: this.isDts(),
        execEnvSelectValue,
        dtsId,
        pipelineBrowserVisible: false,
        dockerImageBrowserVisible: false,
        pipeline: null,
        version: null,
        pipelineConfiguration: null,
        launchCluster: +this.props.parameters.node_count > 0 || autoScaledCluster,
        autoScaledCluster: autoScaledCluster,
        hybridAutoScaledClusterEnabled: hybridAutoScaledCluster,
        gpuScalingConfiguration,
        gridEngineEnabled: gridEngineEnabledValue,
        sparkEnabled: sparkEnabledValue,
        slurmEnabled: slurmEnabledValue,
        kubeEnabled: kubeEnabledValue,
        autoScaledPriceType: autoScaledPriceTypeValue,
        runCapabilities,
        scheduleRules: null,
        nodesCount: +this.props.parameters.node_count,
        maxNodesCount: this.props.parameters.parameters &&
        this.props.parameters.parameters[CP_CAP_AUTOSCALE_WORKERS]
          ? +this.props.parameters.parameters[CP_CAP_AUTOSCALE_WORKERS].value
          : 0,
        bucketBrowserVisible: false,
        bucketPath: null,
        bucketPathParameterKey: null,
        bucketPathParameterSection: null,
        estimatedPrice: {
          evaluated: false,
          pending: false,
          pricePerHour: 0,
          maximumPrice: 0,
          averagePrice: 0,
          minimumPrice: 0
        },
        validation: {
          [EXEC_ENVIRONMENT]: {
            coresNumber: {
              result: 'success',
              message: null
            }
          }
        },
        fireCloudMethodName: null,
        fireCloudMethodNamespace: null,
        fireCloudMethodSnapshot: null,
        fireCloudMethodConfiguration: null,
        fireCloudMethodConfigurationSnapshot: null,
        fireCloudInputs: {},
        fireCloudOutputs: {},
        fireCloudInputsErrors: {},
        fireCloudOutputsErrors: {},
        autoPause: true
      }, () => {
        this.forceValidation = true;
        this.formFieldsChanged();
      });
    }
  };

  generateConfigurationPayload = (values) => {
    let cmd = values[ADVANCED].cmdTemplate;
    if (this.state.useDefaultCmd && this.toolDefaultCmd) {
      cmd = this.toolDefaultCmd;
    } else if (this.state.startIdle) {
      cmd = 'sleep infinity';
    }
    const stopAfterIsIncorrect = (o) => o === null || o === undefined || o === '' || isNaN(o);
    let payload = {
      instance_size: values[EXEC_ENVIRONMENT].type,
      instance_disk: +values[EXEC_ENVIRONMENT].disk,
      timeout: +(values[ADVANCED].timeout || 0),
      stopAfter: stopAfterIsIncorrect(values[ADVANCED].stopAfter)
        ? undefined
        : (+values[ADVANCED].stopAfter || 0),
      endpointName: values[ADVANCED].endpointName,
      cmd_template: cmd,
      node_count: this.state.launchCluster ? this.state.nodesCount : undefined,
      docker_image: values[EXEC_ENVIRONMENT].dockerImage,
      parameters: {},
      configuration: values.configuration,
      is_spot: (values[ADVANCED].is_spot || `${this.getDefaultValue('is_spot')}`) === 'true',
      cloudRegionId: values[EXEC_ENVIRONMENT].cloudRegionId
        ? +values[EXEC_ENVIRONMENT].cloudRegionId
        : undefined
    };
    if (this.isWindowsPlatform) {
      payload.node_count = undefined;
    }
    if (!this.props.detached) {
      delete payload.endpointName;
      delete payload.stopAfter;
    }
    if (this.state.isDts && this.props.detached) {
      payload.instance_size = undefined;
      payload.instance_disk = undefined;
      payload.timeout = undefined;
      payload.is_spot = undefined;
      payload.cloudRegionId = undefined;
      payload.coresNumber = +values[EXEC_ENVIRONMENT].coresNumber || null;
      payload.dtsId = +this.state.dtsId;
    }
    const getBooleanValue = (value) => {
      if (typeof value === 'boolean') {
        return value;
      } else if (value === undefined) {
        return false;
      } else {
        return value === 'true';
      }
    };
    if (!this.isFireCloudSelected) {
      if (values[PARAMETERS] && values[PARAMETERS].keys) {
        for (let i = 0; i < values[PARAMETERS].keys.length; i++) {
          const key = values[PARAMETERS].keys[i];
          if (
            !values[PARAMETERS].hasOwnProperty('params') ||
            !values[PARAMETERS].params.hasOwnProperty(key)
          ) {
            continue;
          }
          const parameter = values[PARAMETERS].params[key];
          if (parameter && parameter.name) {
            payload[PARAMETERS][parameter.name] = {
              type: parameter.type,
              value: (parameter.type || '').toLowerCase() === 'boolean'
                ? getBooleanValue(parameter.value)
                : (parameter.value || ''),
              required: `${parameter.required || false}`.toLowerCase() === 'true',
              description: parameter.description,
              enum: parameter.initialEnumeration,
              visible: parameter.visible,
              validation: parameter.validation,
              no_override: parameter.noOverride
            };
          }
        }
      }
      if (values[ADVANCED].limitMounts && !this.isWindowsPlatform) {
        payload[PARAMETERS][CP_CAP_LIMIT_MOUNTS] = {
          type: 'string',
          required: false,
          value: values[ADVANCED].limitMounts
        };
      }
      if (values[SYSTEM_PARAMETERS] && values[SYSTEM_PARAMETERS].keys) {
        for (let i = 0; i < values[SYSTEM_PARAMETERS].keys.length; i++) {
          const key = values[SYSTEM_PARAMETERS].keys[i];
          if (
            !values[SYSTEM_PARAMETERS].hasOwnProperty('params') ||
            !values[SYSTEM_PARAMETERS].params.hasOwnProperty(key)
          ) {
            continue;
          }
          const parameter = values[SYSTEM_PARAMETERS].params[key];
          if (parameter && parameter.name) {
            payload[PARAMETERS][parameter.name] = {
              type: parameter.type,
              value: (parameter.type || '').toLowerCase() === 'boolean'
                ? getBooleanValue(parameter.value)
                : (parameter.value || ''),
              required: `${parameter.required || false}`.toLowerCase() === 'true',
              description: parameter.description,
              enum: parameter.initialEnumeration,
              visible: parameter.visible,
              validation: parameter.validation
            };
          }
        }
      }
      if (this.state.launchCluster && this.state.autoScaledCluster) {
        payload[PARAMETERS][CP_CAP_SGE] = {
          type: 'boolean',
          value: true
        };
        payload[PARAMETERS][CP_CAP_AUTOSCALE] = {
          type: 'boolean',
          value: true
        };
        payload[PARAMETERS][CP_CAP_AUTOSCALE_WORKERS] = {
          type: 'int',
          value: +this.state.maxNodesCount
        };
        if (this.state.autoScaledPriceType) {
          payload[PARAMETERS][CP_CAP_AUTOSCALE_PRICE_TYPE] = {
            type: 'string',
            value: this.state.autoScaledPriceType
          };
        } else {
          delete payload[PARAMETERS][CP_CAP_AUTOSCALE_PRICE_TYPE];
        }
        if (this.state.hybridAutoScaledClusterEnabled) {
          payload[PARAMETERS][CP_CAP_AUTOSCALE_HYBRID] = {
            type: 'boolean',
            value: true
          };
        }
        if (this.state.gpuScalingConfiguration) {
          payload[PARAMETERS] = applyGPUScalingParameters(
            this.state.gpuScalingConfiguration,
            payload[PARAMETERS]
          );
        }
      }
      if (this.state.launchCluster && this.state.gridEngineEnabled) {
        payload[PARAMETERS][CP_CAP_SGE] = {
          type: 'boolean',
          value: true
        };
      }
      if (this.state.launchCluster && this.state.sparkEnabled) {
        payload[PARAMETERS][CP_CAP_SPARK] = {
          type: 'boolean',
          value: true
        };
      }
      if (this.state.launchCluster && this.state.slurmEnabled) {
        payload[PARAMETERS][CP_CAP_SLURM] = {
          type: 'boolean',
          value: true
        };
      }
      if (this.state.launchCluster && this.state.kubeEnabled) {
        payload[PARAMETERS][CP_CAP_KUBE] = {
          type: 'boolean',
          value: true
        };
        payload[PARAMETERS][CP_CAP_DIND_CONTAINER] = {
          type: 'boolean',
          value: true
        };
        payload[PARAMETERS][CP_CAP_SYSTEMD_CONTAINER] = {
          type: 'boolean',
          value: true
        };
      }
    }
    applyCapabilities(
      payload[PARAMETERS],
      this.state.runCapabilities,
      this.props.preferences,
      this.toolPlatform
    );
    if (this.props.detached && this.state.pipeline && this.state.version) {
      payload.pipelineId = this.state.pipeline.id;
      payload.pipelineVersion = this.state.version;
      payload.configName = this.state.pipelineConfiguration;
      payload.executionEnvironment = this.state.isDts
        ? DTS_ENVIRONMENT : CLOUD_PLATFORM_ENVIRONMENT;
    }
    if (this.props.detached &&
      this.state.fireCloudMethodName &&
      this.state.fireCloudMethodNamespace &&
      this.state.fireCloudMethodSnapshot) {
      payload.methodName =
        `${this.state.fireCloudMethodNamespace}/${this.state.fireCloudMethodName}`;
      payload.methodSnapshot = this.state.fireCloudMethodSnapshot;
      if (this.state.fireCloudMethodConfiguration &&
        this.state.fireCloudMethodConfigurationSnapshot) {
        payload.methodConfigurationName =
          `${this.state.fireCloudMethodNamespace}/${this.state.fireCloudMethodConfiguration}`;
        payload.methodConfigurationSnapshot = this.state.fireCloudMethodConfigurationSnapshot;
      }
      payload.executionEnvironment = FIRE_CLOUD_ENVIRONMENT;
      const connections = this.getFireCloudConnections();
      if (connections) {
        payload.methodInputs = connections.methodInputs;
        payload.methodOutputs = connections.methodOutputs;
      }
    }
    if (this.props.isDetachedConfiguration) {
      payload.rootEntityId = this.state.rootEntityId;
    }
    return payload;
  };

  generateLaunchPayload = (values) => {
    let cmd = values[ADVANCED].cmdTemplate;
    if (this.state.useDefaultCmd && this.toolDefaultCmd) {
      cmd = this.toolDefaultCmd;
    } else if (this.state.startIdle) {
      cmd = 'sleep infinity';
    }
    const payload = {
      instanceType: values[EXEC_ENVIRONMENT].type,
      hddSize: +values[EXEC_ENVIRONMENT].disk,
      timeout: +(values[ADVANCED].timeout || 0),
      cmdTemplate: cmd,
      nodeCount: this.state.launchCluster ? this.state.nodesCount : undefined,
      dockerImage: values[EXEC_ENVIRONMENT].dockerImage,
      pipelineId: this.props.pipeline ? this.props.pipeline.id : undefined,
      version: this.props.version,
      params: {},
      isSpot: (values[ADVANCED].is_spot || `${this.getDefaultValue('is_spot')}`) === 'true',
      cloudRegionId: values[EXEC_ENVIRONMENT].cloudRegionId
        ? +values[EXEC_ENVIRONMENT].cloudRegionId
        : undefined,
      prettyUrl: this.prettyUrlEnabled
        ? prettyUrlGenerator.build(values[ADVANCED].prettyUrl)
        : undefined,
      notifications: (this.state.notifications || []).slice()
    };
    if (this.isWindowsPlatform) {
      payload.node_count = undefined;
    }
    if (this.state.runNameAlias) {
      payload.runNameAlias = this.state.runNameAlias;
    }
    if ((values[ADVANCED].is_spot ||
      `${this.getDefaultValue('is_spot')}`) !== 'true' &&
      !this.state.autoScaledCluster &&
      !this.state.launchCluster &&
      !this.state.autoPause) {
      payload.nonPause = true;
    }
    const getBooleanValue = (value) => {
      if (typeof value === 'boolean') {
        return value;
      } else if (value === undefined) {
        return false;
      } else {
        return value === 'true';
      }
    };
    if (values[PARAMETERS] && values[PARAMETERS].keys) {
      for (let i = 0; i < values[PARAMETERS].keys.length; i++) {
        const key = values[PARAMETERS].keys[i];
        if (
          !values[PARAMETERS].hasOwnProperty('params') ||
          !values[PARAMETERS].params.hasOwnProperty(key)
        ) {
          continue;
        }
        const parameter = values[PARAMETERS].params[key];
        if (parameter && parameter.name && parameter.value) {
          payload.params[parameter.name] = {
            type: parameter.type,
            value: (parameter.type || '').toLowerCase() === 'boolean'
              ? getBooleanValue(parameter.value)
              : (parameter.value || ''),
            required: `${parameter.required || false}`.toLowerCase() === 'true',
            enum: parameter.initialEnumeration,
            visible: parameter.visible,
            validation: parameter.validation,
            no_override: parameter.noOverride,
            section: parameter.section
          };
        }
      }
    }
    if (values[ADVANCED].limitMounts && !this.isWindowsPlatform) {
      payload.params[CP_CAP_LIMIT_MOUNTS] = {
        type: 'string',
        required: false,
        value: values[ADVANCED].limitMounts
      };
    }
    if (values[SYSTEM_PARAMETERS] && values[SYSTEM_PARAMETERS].keys) {
      for (let i = 0; i < values[SYSTEM_PARAMETERS].keys.length; i++) {
        const key = values[SYSTEM_PARAMETERS].keys[i];
        if (
          !values[SYSTEM_PARAMETERS].hasOwnProperty('params') ||
          !values[SYSTEM_PARAMETERS].params.hasOwnProperty(key)
        ) {
          continue;
        }
        const parameter = values[SYSTEM_PARAMETERS].params[key];
        if (parameter && parameter.name && parameter.value) {
          payload.params[parameter.name] = {
            type: parameter.type,
            value: (parameter.type || '').toLowerCase() === 'boolean'
              ? getBooleanValue(parameter.value)
              : (parameter.value || ''),
            required: `${parameter.required || false}`.toLowerCase() === 'true',
            description: parameter.description,
            enum: parameter.initialEnumeration,
            visible: parameter.visible,
            validation: parameter.validation
          };
        }
      }
    }
    if (this.state.launchCluster && this.state.autoScaledCluster) {
      payload.params[CP_CAP_SGE] = {
        type: 'boolean',
        value: true
      };
      payload.params[CP_CAP_AUTOSCALE] = {
        type: 'boolean',
        value: true
      };
      payload.params[CP_CAP_AUTOSCALE_WORKERS] = {
        type: 'int',
        value: +this.state.maxNodesCount
      };
      if (this.state.autoScaledPriceType) {
        payload.params[CP_CAP_AUTOSCALE_PRICE_TYPE] = {
          type: 'string',
          value: this.state.autoScaledPriceType
        };
      } else {
        delete payload.params[CP_CAP_AUTOSCALE_PRICE_TYPE];
      }
      if (this.state.hybridAutoScaledClusterEnabled) {
        payload.params[CP_CAP_AUTOSCALE_HYBRID] = {
          type: 'boolean',
          value: true
        };
      }
      if (this.state.gpuScalingConfiguration) {
        payload.params = applyGPUScalingParameters(
          this.state.gpuScalingConfiguration,
          payload.params
        );
      }
    }
    if (this.state.launchCluster && this.state.gridEngineEnabled) {
      payload.params[CP_CAP_SGE] = {
        type: 'boolean',
        value: true
      };
    }
    if (this.state.launchCluster && this.state.sparkEnabled) {
      payload.params[CP_CAP_SPARK] = {
        type: 'boolean',
        value: true
      };
    }
    if (this.state.launchCluster && this.state.slurmEnabled) {
      payload.params[CP_CAP_SLURM] = {
        type: 'boolean',
        value: true
      };
    }
    if (this.state.launchCluster && this.state.kubeEnabled) {
      payload.params[CP_CAP_KUBE] = {
        type: 'boolean',
        value: true
      };
      payload.params[CP_CAP_DIND_CONTAINER] = {
        type: 'boolean',
        value: true
      };
      payload.params[CP_CAP_SYSTEMD_CONTAINER] = {
        type: 'boolean',
        value: true
      };
    }
    applyCapabilities(
      payload.params,
      this.state.runCapabilities,
      this.props.preferences,
      this.toolPlatform
    );
    if (!payload.isSpot &&
      !this.state.launchCluster &&
      this.state.scheduleRules &&
      this.state.scheduleRules.length > 0) {
      payload.scheduleRules = this.state.scheduleRules;
    }
    return payload;
  };

  getSectionFieldDecorator = (section) => (name, ...opts) => {
    return this.props.form.getFieldDecorator(`${section}.${name}`, ...opts);
  };

  getSectionFieldValue = (section) => (name, ...opts) => {
    if (name) {
      return this.props.form.getFieldValue(`${section}.${name}`, ...opts);
    } else {
      return this.props.form.getFieldValue(section, ...opts);
    }
  };

  getSectionValue = (section, ...opts) => {
    return this.props.form.getFieldValue(section, ...opts);
  };

  getDefaultValue = (key) => {
    if (!key || !this.props.parameters) {
      return undefined;
    }
    if (key.split('.')[0] === 'instanceType') {
      return this.getInstanceTypeParameterDefaultValue(key.split('.')[1]);
    } if (key.split('.')[0] === 'parameters') {
      return this.getParameterDefaultValue(key.split('.')[1]);
    } else if (key.toLowerCase() === 'is_spot') {
      if (this.props.parameters[key] !== undefined && this.props.parameters[key] !== null) {
        return `${this.props.parameters[key]}`;
      } else {
        return `${this.props.defaultPriceTypeIsSpot}`;
      }
    } else if (!this.props.parameters[key]) {
      return undefined;
    }
    return `${this.props.parameters[key]}`;
  };

  getInstanceTypes = (instanceTypesRequest) => {
    if (!instanceTypesRequest) {
      return [];
    }
    const instanceTypes = [];
    for (let i = 0; i < instanceTypesRequest.length; i++) {
      const instanceType = instanceTypesRequest[i];
      if (instanceTypes.filter(t => t.name === instanceType.name).length === 0) {
        instanceTypes.push(instanceType);
      }
    }
    return instanceTypes.sort((typeA, typeB) => {
      const vcpuCompared = typeA.vcpu - typeB.vcpu;
      const skuCompare = (a, b) => {
        return a.instanceFamily > b.instanceFamily
          ? 1
          : a.instanceFamily < b.instanceFamily ? -1 : 0;
      };
      return vcpuCompared === 0 ? skuCompare(typeA, typeB) : vcpuCompared;
    });
  };

  @computed
  get instanceTypesLoaded () {
    return this.props.allowedInstanceTypes && this.props.allowedInstanceTypes.loaded;
  }

  @computed
  get instanceTypes () {
    const request = this.props.allowedInstanceTypes && this.props.allowedInstanceTypes.loaded
      ? this.props.allowedInstanceTypes
      : null;
    if (request) {
      if (this.state.pipeline) {
        return this.getInstanceTypes(request.value[this.props.instanceTypes]);
      } else {
        return this.getInstanceTypes(request.value[this.props.toolInstanceTypes]);
      }
    }
    return [];
  }

  @computed
  get priceTypes () {
    let availableMasterNodeTypes = [true, false];
    if (this.state.launchCluster && this.props.preferences.loaded) {
      availableMasterNodeTypes = this.props.preferences.allowedMasterPriceTypes;
    }
    if (!this.props.allowedInstanceTypes || !this.props.allowedInstanceTypes.loaded) {
      return availableMasterNodeTypes;
    }
    return (this.props.allowedInstanceTypes.value[names.allowedPriceTypes] || [])
      .map(v => {
        if (v === 'spot') {
          return true;
        } else if (v === 'on_demand') {
          return false;
        }
        return undefined;
      })
      .filter(v => v !== undefined && availableMasterNodeTypes.indexOf(v) >= 0);
  }

  getInstanceTypeParameterDefaultValue = (key) => {
    if (!this.props.parameters) {
      return undefined;
    }
    const type = this.props.parameters['instance_size'];
    const [instanceType] = this.instanceTypes.filter(t => t.name === type);
    if (key && instanceType) {
      return `${instanceType[key]}`;
    }
    return undefined;
  };

  getParameterDefaultValue = (key) => {
    if (!this.props.parameters) {
      return undefined;
    }
    if (this.props.parameters.parameters) {
      for (let pKey in this.props.parameters.parameters) {
        if (this.props.parameters.parameters.hasOwnProperty(pKey) && pKey === key) {
          return this.props.parameters.parameters[pKey].value;
        }
      }
    }
    return undefined;
  };

  diskSizeChanged = ({target: {value}}) => {
    this.evaluateEstimatedPrice({disk: value});
  };

  prepare = (updateFireCloud = false) => {
    const autoScaledCluster = autoScaledClusterEnabled(this.props.parameters.parameters);
    const hybridAutoScaledCluster = hybridAutoScaledClusterEnabled(
      this.props.parameters.parameters
    );
    const gpuScalingConfiguration = readGPUScalingPreference(
      {
        autoScaled: autoScaledCluster,
        provider: this.currentCloudRegionProvider,
        hybrid: hybridAutoScaledCluster,
        parameters: this.props.parameters.parameters
      },
      this.props.preferences
    );
    const gridEngineEnabledValue = gridEngineEnabled(this.props.parameters.parameters);
    const sparkEnabledValue = sparkEnabled(this.props.parameters.parameters);
    const slurmEnabledValue = slurmEnabled(this.props.parameters.parameters);
    const kubeEnabledValue = kubeEnabled(this.props.parameters.parameters);
    const autoScaledPriceTypeValue = getAutoScaledPriceTypeValue(this.props.parameters.parameters);
    const runCapabilities = getEnabledCapabilities(this.props.parameters.parameters);
    let state = {
      launchCluster: +this.props.parameters.node_count > 0 || autoScaledCluster,
      autoScaledCluster: autoScaledCluster,
      hybridAutoScaledClusterEnabled: hybridAutoScaledCluster,
      gpuScalingConfiguration,
      gridEngineEnabled: gridEngineEnabledValue,
      sparkEnabled: sparkEnabledValue,
      slurmEnabled: slurmEnabledValue,
      kubeEnabled: kubeEnabledValue,
      autoScaledPriceType: autoScaledPriceTypeValue,
      runCapabilities,
      nodesCount: +this.props.parameters.node_count,
      maxNodesCount: this.props.parameters.parameters &&
      this.props.parameters.parameters[CP_CAP_AUTOSCALE_WORKERS]
        ? +this.props.parameters.parameters[CP_CAP_AUTOSCALE_WORKERS].value
        : 0,
      pipeline: this.props.pipeline,
      version: this.props.version,
      pipelineConfiguration: this.props.pipelineConfiguration
    };
    if (updateFireCloud) {
      state = Object.assign(state, {
        fireCloudMethodName: this.props.fireCloudMethod
          ? this.props.fireCloudMethod.name : null,
        fireCloudMethodNamespace: this.props.fireCloudMethod
          ? this.props.fireCloudMethod.namespace : null,
        fireCloudMethodSnapshot: this.props.fireCloudMethod
          ? this.props.fireCloudMethod.snapshot : null,
        fireCloudMethodConfiguration: this.props.fireCloudMethod
          ? this.props.fireCloudMethod.configuration : null,
        fireCloudMethodConfigurationSnapshot: this.props.fireCloudMethod
          ? this.props.fireCloudMethod.configurationSnapshot : null,
        fireCloudInputs: {},
        fireCloudOutputs: {},
        fireCloudDefaultInputs: this.props.fireCloudMethod
          ? this.props.fireCloudMethod.methodInputs
          : null,
        fireCloudDefaultOutputs: this.props.fireCloudMethod
          ? this.props.fireCloudMethod.methodOutputs
          : null
      });
    }
    this.setState(state);
  };

  evaluateEstimatedPrice = async ({disk, type, isSpot, cloudRegionId}) => {
    if (!disk) {
      disk = this.getSectionFieldValue(EXEC_ENVIRONMENT)('disk') ||
        this.getDefaultValue('instance_disk');
    }
    if (!type) {
      this.props.allowedInstanceTypes &&
      await this.props.allowedInstanceTypes.fetchIfNeededOrWait();
      type = this.getSectionFieldValue(EXEC_ENVIRONMENT)('type') ||
        this.correctInstanceTypeValue(this.getDefaultValue('instance_size'));
    }
    if (!isSpot) {
      isSpot = this.getSectionFieldValue(ADVANCED)('is_spot') || this.getDefaultValue('is_spot');
    }
    if (!cloudRegionId) {
      cloudRegionId = this.getSectionFieldValue(EXEC_ENVIRONMENT)('cloudRegionId') ||
        this.getDefaultValue('cloudRegionId') || this.defaultCloudRegionId;
    }
    isSpot = `${isSpot}` === 'true';
    if (!isNaN(disk) && type && !this.state.estimatedPrice.pending) {
      const request = this.props.pipeline
        ? new PipelineRunEstimatedPrice(
          this.props.pipeline.id,
          this.props.version,
          this.props.currentConfigurationName
        )
        : new PipelineRunEstimatedPrice();
      const estimatedPriceState = this.state.estimatedPrice;
      estimatedPriceState.pending = true;
      this.setState({estimatedPrice: estimatedPriceState}, async () => {
        await request.send({
          'instanceType': type,
          'instanceDisk': disk,
          'spot': isSpot,
          'regionId': cloudRegionId
        });
        estimatedPriceState.pending = false;
        if (!request.error) {
          const adjustPrice = (value) => {
            let cents = Math.ceil(value * 100);
            if (cents < 1) {
              cents = 1;
            }
            return cents / 100;
          };
          estimatedPriceState.evaluated = true;
          estimatedPriceState.averagePrice = adjustPrice(request.value.averageTimePrice);
          estimatedPriceState.maximumPrice = adjustPrice(request.value.maximumTimePrice);
          estimatedPriceState.minimumPrice = adjustPrice(request.value.minimumTimePrice);
          estimatedPriceState.pricePerHour = adjustPrice(request.value.pricePerHour);
        }
        this.setState({estimatedPrice: estimatedPriceState});
      });
    }
  };

  instanceTypeChanged = (newType) => {
    const [instanceType] = this.instanceTypes.filter(t => t.name === newType);
    if (instanceType) {
      this.evaluateEstimatedPrice({type: instanceType.name});
    }
  };

  renderEstimatedPriceTable = (multiply = 1) => {
    const priceElements = [];
    const {pricePerHour, minimumPrice, maximumPrice, averagePrice} = this.state.estimatedPrice;
    priceElements.push({
      key: 'pricePerHour',
      title: 'Price per hour:',
      value: `${(pricePerHour * multiply).toFixed(2)} $`
    });
    if (minimumPrice) {
      priceElements.push({
        key: 'minimumTimePrice',
        title: 'Minimum price:',
        value: `${(minimumPrice * multiply).toFixed(2)} $`
      });
    }
    if (maximumPrice) {
      priceElements.push({
        key: 'maximumTimePrice',
        title: 'Maximum price:',
        value: `${(maximumPrice * multiply).toFixed(2)} $`
      });
    }
    if (averagePrice) {
      priceElements.push({
        key: 'averageTimePrice',
        title: 'Average price:',
        value: `${(averagePrice * multiply).toFixed(2)} $`
      });
    }
    return (
      <Spin spinning={this.state.estimatedPrice.pending}>
        <Row>
          <ul id="launch-pipeline-estimated-price-list">
            {
              priceElements.map(e =>
                <li
                  id={`launch-pipeline-estimated-price-list-item-${e.key}`}
                  key={e.key}><b>{e.title}</b> {e.value}</li>
              )
            }
          </ul>
        </Row>
      </Spin>);
  };
  renderEstimatedPriceInfo = () => {
    if (this.state.estimatedPrice.pending) {
      return undefined;
    }
    const className = classNames(
      styles.price,
      {'cp-text-not-important': this.state.estimatedPrice.pending}
    );
    if (this.state.estimatedPrice.averagePrice > 0) {
      const info = (
        <Popover
          placement="bottom"
          content={this.renderEstimatedPriceTable(this.multiplyValueBy)}
          trigger="hover">
          <Icon
            className={styles.hint}
            type="info-circle"
          />
        </Popover>
      );
      const {pricePerHour} = this.state.estimatedPrice;
      const priceStr = (
        <JobEstimatedPriceInfo>
          {(pricePerHour * this.multiplyValueBy).toFixed(2)} $
        </JobEstimatedPriceInfo>
      );
      return (
        <span style={{marginLeft: 5}}>Estimated price per hour: <span className={className}>
          {priceStr} {info}</span>
        </span>
      );
    } else if (this.state.estimatedPrice.pricePerHour > 0) {
      const {pricePerHour} = this.state.estimatedPrice;
      const priceStr = (
        <JobEstimatedPriceInfo>
          {(pricePerHour * this.multiplyValueBy).toFixed(2)} $
        </JobEstimatedPriceInfo>
      );
      return (
        <span style={{marginLeft: 5}}>Estimated price per hour: <span className={className}>
          {priceStr}</span>
        </span>
      );
    }
  };
  selectButcketPath = (path) => {
    const key = this.state.bucketPathParameterKey;
    const sectionName = this.state.bucketPathParameterSection;
    if (key && sectionName) {
      const parametersValue = this.getSectionValue(sectionName);
      parametersValue.params[key].value = path;
      this.props.form.setFieldsValue({[sectionName]: parametersValue});
      this.props.form.validateFieldsAndScroll();
      this.closeBucketBrowser();
    }
  };

  cmdTemplateEditorValueChanged = (code) => {
    const advancedValues = this.getSectionValue(ADVANCED) || {};
    advancedValues.cmdTemplate = code;
    this.cmdTemplateValue = code;
    this.props.form.setFieldsValue({[ADVANCED]: advancedValues});
  };

  parameterIndexIdentifier = {
    system: 0,
    nonSystem: 0
  };

  buildDefaultParameters = (system = false) => {
    const parameters = {
      keys: [],
      params: {}}
    ;
    const parameterIndexIdentifierKey = system ? 'system' : 'nonSystem';
    const getBooleanValue = (value) => {
      if (typeof value === 'boolean') {
        return `${value}`;
      } else if (value === undefined) {
        return 'false';
      } else {
        return `${value === 'true'}`;
      }
    };
    if (this.props.parameters.parameters) {
      for (let key in this.props.parameters.parameters) {
        if (this.props.parameters.parameters.hasOwnProperty(key)) {
          if (
            this.isSystemParameter({name: key}) !== system ||
            isCustomCapability(key, this.props.preferences)
          ) {
            continue;
          }
          const parametersToSkip = [
            CP_CAP_LIMIT_MOUNTS,
            ...getSkippedSystemParametersList(this)
          ].filter(Boolean);
          if (parametersToSkip.includes(key)) {
            continue;
          }
          this.parameterIndexIdentifier[parameterIndexIdentifierKey] =
            this.parameterIndexIdentifier[parameterIndexIdentifierKey] + 1;
          parameters.keys.push(
            `param_${this.parameterIndexIdentifier[parameterIndexIdentifierKey]}`
          );
          let value;
          let resolvedValue;
          let type = 'string';
          let required = false;
          let readOnly = false;
          let noOverride = false;
          let description;
          let enumeration;
          let initialEnumeration;
          let visible;
          let validation;
          let section;
          const parameter = this.props.parameters.parameters[key];
          if (parameter.value !== undefined ||
            parameter.type !== undefined ||
            parameter.required !== undefined) {
            let prevValue;
            if (this.prevParameters && this.prevParameters.params) {
              for (let paramKey in this.prevParameters.params) {
                if (this.prevParameters.params[paramKey].name === key) {
                  prevValue = this.prevParameters.params[paramKey].value;
                }
              }
            }
            value = prevValue && !parameter.value ? prevValue : parameter.value;
            resolvedValue = parameter.resolvedValue;
            type = parameter.type || 'string';
            enumeration = parameter.enum;
            description = parameter.description;
            initialEnumeration = parameter.enum;
            visible = parameter.visible;
            validation = parameter.validation;
            noOverride = `${parameter.no_override}` === 'true';
            section = parameter.section || OTHER_PARAMETERS_GROUP;
            enumeration = parameterUtilities.parseEnumeration({enumeration});
            if (type.toLowerCase() === 'boolean') {
              value = getBooleanValue(value);
              resolvedValue = resolvedValue !== undefined
                ? getBooleanValue(resolvedValue)
                : resolvedValue;
            }
            required = parameter.required;
            readOnly = this.props.isDetachedConfiguration &&
              this.props.detached &&
              !!value && noOverride;
          } else {
            value = parameter;
          }
          const paramKey = `param_${this.parameterIndexIdentifier[parameterIndexIdentifierKey]}`;
          parameters.params[paramKey] = {
            name: key,
            key: `param_${this.parameterIndexIdentifier[parameterIndexIdentifierKey]}`,
            type: type,
            enumeration,
            initialEnumeration,
            visible,
            validation,
            description,
            value,
            resolvedValue,
            hasResolvedValue: resolvedValue !== undefined && resolvedValue !== value,
            required: required,
            readOnly: readOnly,
            system: system,
            noOverride,
            initial: true,
            section: section
          };
        }
      }
    }
    return parameters;
  };

  renderStringParameter = (
    sectionName,
    {key, value, required, readOnly, validator},
    system,
    visible
  ) => {
    const rules = [];
    if (validator) {
      rules.push({validator});
    }
    if (visible && (required || system)) {
      rules.push({
        required: true,
        message: 'Required'
      });
    }
    return (
      <FormItem
        className={styles.formItemRow}
        required={visible && (required || system)}
        hasFeedback>
        {
          this.getSectionFieldDecorator(sectionName)(`params.${key}.value`,
            {
              rules: rules,
              initialValue: value,
              onChange: () => { this.forceValidation = true; }
            })(
            this.props.isDetachedConfiguration ? (
              <AutoCompleteForParameter
                readOnly={(this.props.readOnly && !this.props.canExecute) || readOnly}
                placeholder={'Value'}
                parameterKey={key}
                currentMetadataEntity={this.state.currentMetadataEntity.slice()}
                currentProjectMetadata={this.state.currentProjectMetadata}
                rootEntityId={this.state.rootEntityId}
                showWithButton
              />
            ) : (
              <Input
                disabled={(this.props.readOnly && !this.props.canExecute) || readOnly}
                placeholder="Value"
                className={styles.parameterValue}
              />
            )
          )
        }
      </FormItem>
    );
  };

  renderSelectionParameter = (
    sectionName,
    {key, value, required, readOnly, enumeration, description, validator},
    system = false,
    parameters
  ) => {
    const rules = [];
    if (validator) {
      rules.push({validator});
    }
    if (required || system) {
      rules.push({
        required: true,
        message: 'Required'
      });
    }
    return (
      <FormItem
        className={styles.formItemRow}
        required={required || system}
        hasFeedback>
        {
          this.getSectionFieldDecorator(sectionName)(`params.${key}.value`,
            {
              rules: rules,
              initialValue: value,
              onChange: () => { this.forceValidation = true; }
            }
          )(
            <Select
              disabled={(this.props.readOnly && !this.props.canExecute) || readOnly}
              placeholder="Value"
              className={styles.parameterValue}
            >
              {
                enumeration
                  .filter(e => e.isVisible(parameters))
                  .map(e => (
                    <Select.Option
                      key={e.name}
                      value={e.name}
                    >
                      {e.name}
                    </Select.Option>
                  ))
              }
            </Select>
          )
        }
      </FormItem>
    );
  };

  renderBooleanParameter = (
    sectionName,
    {key, value, readOnly, validator}
  ) => {
    const rules = [];
    if (validator) {
      rules.push({validator});
    }
    return (
      <FormItem className={styles.formItemRow}>
        {
          this.getSectionFieldDecorator(sectionName)(`params.${key}.value`,
            {
              initialValue: value,
              rules,
              onChange: () => { this.forceValidation = true; }
            }
          )(
            <BooleanParameterInput
              disabled={(this.props.readOnly && !this.props.canExecute) || readOnly}
              className={styles.parameterValue} />
          )
        }
      </FormItem>
    );
  };

  openBucketBrowser = (sectionName, key, value, type) => {
    this.setState({
      bucketBrowserVisible: true,
      bucketPath: value,
      bucketPathParameterKey: key,
      bucketPathParameterSection: sectionName,
      showOnlyFolderInBucketBrowser: type === 'output'
    });
  };

  closeBucketBrowser = () => {
    this.setState({
      bucketBrowserVisible: false,
      bucketPath: null,
      bucketPathParameterKey: null,
      bucketPathParameterSection: null,
      showOnlyFolderInBucketBrowser: false
    });
  };
  renderPathParameter = (
    sectionName,
    {key, value, required, readOnly, validator},
    type,
    system,
    visible
  ) => {
    let icon;
    switch (type) {
      case 'input': icon = 'download'; break;
      case 'output': icon = 'upload'; break;
      case 'common': icon = 'select'; break;
      default: icon = 'folder'; break;
    }
    const rules = [];
    if (validator) {
      rules.push({validator});
    }
    if (visible && (required || system)) {
      rules.push({
        required: true,
        message: 'Required'
      });
    }
    rules.push({
      validator: (rule, value, callback) => {
        if (value && value.length) {
          const parts = value
            .split(',')
            .map(f => f.trim())
            .filter(f => f.toLowerCase().indexOf('nfs://') === 0);
          if (parts.length) {
            // eslint-disable-next-line
            callback('NFS mounts are not supported');
          }
        }
        callback();
      }
    });
    return (
      <FormItem
        className={styles.formItemRow}
        required={visible && (required || system)}
        hasFeedback>
        {
          this.getSectionFieldDecorator(sectionName)(`params.${key}.value`, {
            rules: rules,
            initialValue: value,
            onChange: () => { this.forceValidation = true; }
          })(
            this.props.isDetachedConfiguration ? (
              <AutoCompleteForParameter
                readOnly={(this.props.readOnly && !this.props.canExecute) || readOnly}
                placeholder={'Path'}
                parameterKey={key}
                currentMetadataEntity={this.state.currentMetadataEntity.slice()}
                currentProjectMetadata={this.state.currentProjectMetadata}
                rootEntityId={this.state.rootEntityId}
                showWithButton={false}
                buttonIcon={icon}
                onButtonClick={(selectKey, selectValue) => {
                  this.openBucketBrowser(sectionName, selectKey, selectValue, type);
                }}
              />
            ) : (
              <Input
                disabled={(this.props.readOnly && !this.props.canExecute) || readOnly}
                style={{width: '100%'}}
                addonBefore={
                  <div
                    className={styles.pathType}
                    onClick={() =>
                      !(this.props.readOnly && !this.props.canExecute) &&
                      this.openBucketBrowser(sectionName, key, value, type)}>
                    <Icon type={icon} />
                  </div>}
                placeholder="Path"
              />
            )
          )
        }
      </FormItem>
    );
  };

  openPipelineBrowser = () => {
    if (this.pipelineInput) {
      this.pipelineInput.blur();
    }
    this.setState({pipelineBrowserVisible: true});
  };

  closePipelineBrowser = () => {
    this.setState({pipelineBrowserVisible: false}, this.formFieldsChanged);
  };

  selectPipelineConfirm = async (pipeline, isFireCloud = false) => {
    return new Promise((resolve) => {
      const selectPipeline = () => this.selectPipeline(pipeline, isFireCloud);
      Modal.confirm({
        title: 'Are you sure you want to change configuration?',
        style: {
          wordWrap: 'break-word'
        },
        content: 'Current parameters and values may be lost.',
        async onOk () {
          selectPipeline();
          resolve(true);
        },
        onCancel () {
          resolve(false);
        },
        okText: 'Yes',
        cancelText: 'No'
      });
    });
  };

  selectPipeline = (pipeline, isFireCloud = false) => {
    if (isFireCloud) {
      if (pipeline.name &&
        pipeline.namespace &&
        pipeline.snapshot) {
        if (this.state.fireCloudMethodName !== pipeline.name ||
          this.state.fireCloudMethodNamespace !== pipeline.namespace ||
          this.state.fireCloudMethodSnapshot !== pipeline.snapshot ||
          this.state.fireCloudMethodConfiguration !== pipeline.configuration ||
          this.state.fireCloudMethodConfigurationSnapshot !== pipeline.configurationSnapshot) {
          this.setState({
            fireCloudMethodName: pipeline.name,
            fireCloudMethodNamespace: pipeline.namespace,
            fireCloudMethodSnapshot: pipeline.snapshot,
            fireCloudMethodConfiguration: pipeline.configuration,
            fireCloudMethodConfigurationSnapshot: pipeline.configurationSnapshot,
            fireCloudInputs: {},
            fireCloudOutputs: {},
            fireCloudInputsErrors: {},
            fireCloudOutputsErrors: {},
            fireCloudDefaultInputs: [],
            fireCloudDefaultOutputs: [],
            pipeline: null,
            version: null,
            configuration: null
          }, () => {
            if (this.props.onSelectPipeline) {
              this.props.onSelectPipeline({
                fireCloudMethodName: pipeline.name,
                fireCloudMethodNamespace: pipeline.namespace,
                fireCloudMethodSnapshot: pipeline.snapshot,
                fireCloudMethodConfiguration: pipeline.configuration,
                fireCloudMethodConfigurationSnapshot: pipeline.configurationSnapshot,
                isFireCloud: true
              }, () => {
                this.prevParameters = this.props.form.getFieldsValue().parameters;
                this.reset(true);
                this.evaluateEstimatedPrice({});
              });
            }
          });
        }
      } else {
        this.setState({
          fireCloudMethodName: null,
          fireCloudMethodNamespace: null,
          fireCloudMethodSnapshot: null,
          fireCloudMethodConfiguration: null,
          fireCloudMethodConfigurationSnapshot: null,
          fireCloudInputs: {},
          fireCloudOutputs: {},
          fireCloudInputsErrors: {},
          fireCloudOutputsErrors: {},
          fireCloudDefaultInputs: [],
          fireCloudDefaultOutputs: []
        }, () => {
          if (this.props.onSelectPipeline) {
            this.props.onSelectPipeline(null, () => {
              this.reset(true);
            });
          }
        });
      }
    } else {
      if (pipeline) {
        const [existedPipeline] = this.props.pipelines.filter(p => p.id === pipeline.id);
        if (existedPipeline) {
          this.addedParameters = {};
          this.rebuildParameters = {
            [PARAMETERS]: true,
            [SYSTEM_PARAMETERS]: true
          };
          this.setState({
            pipeline: existedPipeline,
            version: pipeline.version,
            pipelineConfiguration: pipeline.configuration,
            fireCloudMethodName: null,
            fireCloudMethodNamespace: null,
            fireCloudMethodSnapshot: null,
            fireCloudMethodConfiguration: null,
            fireCloudMethodConfigurationSnapshot: null,
            fireCloudInputs: {},
            fireCloudOutputs: {},
            fireCloudInputsErrors: {},
            fireCloudOutputsErrors: {},
            fireCloudDefaultInputs: [],
            fireCloudDefaultOutputs: []
          }, () => {
            if (this.props.onSelectPipeline) {
              this.props.onSelectPipeline({
                pipeline: existedPipeline,
                version: pipeline.version,
                configuration: pipeline.configuration
              }, () => {
                this.prevParameters = this.props.form.getFieldsValue().parameters;
                this.reset(true);
                this.evaluateEstimatedPrice({});
              });
            }
          });
        }
      } else {
        this.setState({
          pipeline: null,
          version: null,
          configuration: null
        }, () => {
          if (this.props.onSelectPipeline) {
            this.props.onSelectPipeline(null, () => {
              this.reset(true);
            });
          }
        });
      }
    }
    this.closePipelineBrowser();
    this.formFieldsChanged();
  };

  openMetadataBrowser = () => {
    if (this.pipelineInput) {
      this.pipelineInput.blur();
    }
    this.setState({metadataBrowserVisible: true});
  };

  closeMetadataBrowser = () => {
    this.setState({metadataBrowserVisible: false});
  };

  selectMetadataConfirm = (entitiesIds, metadataClass, expansionExpression, folderId) => {
    this.run(
      {key: this.state.currentLaunchKey},
      entitiesIds,
      metadataClass,
      expansionExpression,
      folderId
    );
  };

  renderPipelineSelection = () => {
    if (!this.props.detached) {
      return undefined;
    }
    let inputValue;
    if (this.state.pipeline) {
      inputValue = this.state.pipeline.name;
      if (this.state.version && !this.state.pipeline.unknown) {
        let versionStr = `(${this.state.version})`;
        if (this.state.pipelineConfiguration) {
          versionStr = `(${this.state.version} - ${this.state.pipelineConfiguration})`;
        }
        inputValue = `${inputValue} ${versionStr}`;
      }
    } else if (this.state.fireCloudMethodName &&
      this.state.fireCloudMethodNamespace &&
      this.state.fireCloudMethodSnapshot) {
      inputValue = `${this.state.fireCloudMethodNamespace}/${this.state.fireCloudMethodName}`;
      if (this.state.fireCloudMethodConfiguration) {
        inputValue = `${inputValue} (${this.state.fireCloudMethodConfiguration})`;
      }
    }
    const ref = (input) => {
      if (input && input.refs && input.refs.input) {
        this.pipelineInput = input.refs.input;
      }
    };
    return (
      <FormItem
        className={getFormItemClassName(styles.formItem, 'pipeline')}
        {...this.formItemLayout}
        label={this.localizedString('Pipeline')} >
        <Input
          size="large"
          disabled={this.props.readOnly && !this.props.canExecute}
          ref={ref}
          onFocus={this.openPipelineBrowser}
          value={inputValue}
          onChange={(e) => {}}
          addonBefore={
            <div
              className={styles.pathType}
              onClick={!(this.props.readOnly && !this.props.canExecute) &&
              this.openPipelineBrowser}>
              <Icon type="export" />
            </div>
          } />
      </FormItem>
    );
  };

  renderExecutionEnvironmentSelection = () => {
    if (!this.props.detached) {
      return undefined;
    }
    const onChange = (key) => {
      let isDts = false;
      let [execEnvSelectValue, dtsId] = key.split('.');
      dtsId = +dtsId || null;
      if (execEnvSelectValue === DTS_ENVIRONMENT && dtsId) {
        isDts = true;
        execEnvSelectValue = `${execEnvSelectValue}.${dtsId}`;
      }
      this.setState({isDts, execEnvSelectValue, dtsId});
    };
    return (
      <FormItem
        className={getFormItemClassName(styles.formItem, 'executionEnvironment')}
        {...this.formItemLayout}
        label="Execution environment" >
        <Select
          size="large"
          value={`${this.state.execEnvSelectValue}`}
          onSelect={onChange}
          disabled={
            (this.props.readOnly && !this.props.canExecute) || (!!this.state.fireCloudMethodName)
          }>
          {
            !!this.state.fireCloudMethodName &&
            <Select.Option key={FIRE_CLOUD_ENVIRONMENT}>
              FireCloud
            </Select.Option>
          }
          <Select.Option key={CLOUD_PLATFORM_ENVIRONMENT}>
            {this.props.preferences.deploymentName || 'EPAM Cloud Pipeline'}
          </Select.Option>
          {
            this.dtsList && this.dtsList.map(dts =>
              <Select.Option key={`${DTS_ENVIRONMENT}.${dts.id}`}>
                {dts.name}
              </Select.Option>
            )
          }
        </Select>
      </FormItem>
    );
  };

  @observable
  _dtsClusterInfo = null;
  _dtsCoresTotal = 0;
  _dtsCoresAvailable = 0;

  loadDtsClusterInfo = () => {
    this._dtsClusterInfo = new DTSClusterInfo(this.state.dtsId);
  };

  renderDtsClusterInfo = () => {
    let infoString = '';
    if (!this._dtsClusterInfo) {
      return infoString;
    }
    if (this._dtsClusterInfo.error) {
      infoString = <Alert type="error" message={this._dtsClusterInfo.error} />;
    }
    const nodes = this._dtsClusterInfo.value.nodes;
    if (!this._dtsClusterInfo.error && nodes && nodes.length) {
      nodes.forEach(node => {
        if (!this._dtsCoresTotal || this._dtsCoresTotal < node.slotsTotal) {
          this._dtsCoresTotal = node.slotsTotal;
        }
        const available = node.slotsTotal - node.slotsUsed;
        if (!this._dtsCoresAvailable || this._dtsCoresAvailable < available) {
          this._dtsCoresAvailable = available;
        }
      });
      if (this._dtsCoresTotal) {
        const isPlural = this._dtsCoresTotal !== 1;
        const totalStr = `${this._dtsCoresTotal} core${isPlural ? 's' : ''} total`;
        const availableStr = `${this._dtsCoresAvailable} available`;
        infoString = `${totalStr} / ${availableStr}`;
      }
    }
    return [
      <Col key="info" style={{paddingLeft: 7, flex: 1}}>
        {infoString}
      </Col>,
      <Col key="reload" style={{textAlign: 'center', width: 30}}>
        <Button
          shape="circle"
          icon="reload"
          size="small"
          onClick={this.loadDtsClusterInfo} />
      </Col>
    ];
  };

  validateCoresNumber = (value, callback) => {
    if (!!this.state.fireCloudMethodName || !value) {
      callback();
      return;
    }
    const validation = this.state.validation;
    if (!isNaN(value)) {
      if (+value < 1) {
        validation[EXEC_ENVIRONMENT].coresNumber.result = 'error';
        validation[EXEC_ENVIRONMENT].coresNumber.message = 'Minimum value is 1';
      } else if (this._dtsCoresTotal && +value > this._dtsCoresTotal) {
        validation[EXEC_ENVIRONMENT].coresNumber.result = 'error';
        validation[EXEC_ENVIRONMENT].coresNumber.message =
          'The selected number of cores cannot be more than the total amount';
      } else if (this._dtsCoresTotal && +value > this._dtsCoresAvailable) {
        validation[EXEC_ENVIRONMENT].coresNumber.result = 'warning';
        const availableStr = `At the moment - only ${this._dtsCoresAvailable} cores are available`;
        validation[EXEC_ENVIRONMENT].coresNumber.message =
          `${availableStr}. Your job will wait in queue until more cores are freed`;
      } else {
        validation[EXEC_ENVIRONMENT].coresNumber.result = 'success';
        validation[EXEC_ENVIRONMENT].coresNumber.message = null;
      }
    }
    this.setState({validation});
    if (callback) {
      if (validation[EXEC_ENVIRONMENT].coresNumber.result === 'warning') {
        callback();
      } else {
        callback(validation[EXEC_ENVIRONMENT].coresNumber.message || undefined);
      }
    }
  };

  renderCoresFormItem = () => {
    if (!this.props.detached || !this.state.isDts) {
      return undefined;
    }
    return (
      <FormItem
        className={getFormItemClassName(styles.formItem, 'coresNumber')}
        {...this.formItemLayout}
        label="Cores"
        hasFeedback>
        <Row type="flex" align="start">
          <div style={{flex: 1, display: 'flex', flexDirection: 'row'}}>
            <FormItem
              className={styles.formItem}
              {...this.formItemLayout}
              validateStatus={this.state.validation[EXEC_ENVIRONMENT].coresNumber.result}
              help={this.state.validation[EXEC_ENVIRONMENT].coresNumber.message}
              hasFeedback>
              {this.getSectionFieldDecorator(EXEC_ENVIRONMENT)('coresNumber',
                {
                  rules: [
                    {
                      pattern: /^\d+(\.\d+)?$/,
                      message: 'Please enter a valid positive number'
                    },
                    {
                      validator: (rule, value, callback) =>
                        this.validateCoresNumber(value, callback)
                    }
                  ],
                  initialValue: this.getDefaultValue('coresNumber')
                }
              )(
                <Input
                  disabled={this.props.readOnly && !this.props.canExecute} />
              )}
            </FormItem>
          </div>
          {
            this._dtsClusterInfo && this._dtsClusterInfo.pending
              ? <div style={{flex: 1}}><LoadingView /></div>
              : this.renderDtsClusterInfo()
          }
        </Row>
      </FormItem>
    );
  };

  removeParameter = (sectionName, key) => {
    const parametersValues = this.getSectionValue(sectionName);
    const index = parametersValues.keys.indexOf(key);
    if (index >= 0) {
      parametersValues.keys.splice(index, 1);
      parametersValues.params[key] = undefined;
    }
    this.props.form.setFieldsValue({[sectionName]: parametersValues});
  };

  addedParameters = {};

  addParameter = (sectionName, {type, name, required, defaultValue}, isSystemSection) => {
    const parameterIndexIdentifierKey = isSystemSection ? 'system' : 'nonSystem';
    this.parameterIndexIdentifier[parameterIndexIdentifierKey] =
      this.parameterIndexIdentifier[parameterIndexIdentifierKey] + 1;
    const parametersValues = this.getSectionValue(sectionName);
    let newKeyIndex = `param_${this.parameterIndexIdentifier[parameterIndexIdentifierKey]}`;
    this.addedParameters[newKeyIndex] = {
      type,
      name,
      required,
      value: defaultValue,
      section: !isSystemSection ? OTHER_PARAMETERS_GROUP : undefined
    };
    parametersValues.keys.push(newKeyIndex);
    this.props.form.setFieldsValue({[sectionName]: parametersValues});
  };

  validateParameterName = (sectionName, key, isSystemParameter) => (rule, value, callback) => {
    const parametersValues = this.getSectionValue(sectionName);
    let error = false;
    if (value && value.length > 0) {
      const params = parametersValues.keys
        .map(key => parametersValues.params[key])
        .filter(p => !!p)
        .reduce((obj, param) => {
          obj[param.key] = param;
          return obj;
        }, {});
      if (params[key]) {
        for (let i = 0; i < parametersValues.keys.length; i++) {
          if (parametersValues.keys[i] === key) {
            continue;
          }
          if (params[parametersValues.keys[i]] && params[parametersValues.keys[i]].name === value) {
            error = true;
            break;
          }
        }
      }
    }
    if (error) {
      // eslint-disable-next-line
      callback('No duplicates are allowed');
    } else if (!isSystemParameter && this.isSystemParameterRestrictedByRole({name: value})) {
      // eslint-disable-next-line
      callback('This parameter is not allowed for use');
    } else if (!isSystemParameter && this.isSystemParameter({name: value})) {
      // eslint-disable-next-line
      callback('Name is reserved for system parameter');
    } else if (value &&
      [
        CP_CAP_LIMIT_MOUNTS,
        ...getSkippedSystemParametersList()
      ].indexOf(value.toUpperCase()) >= 0) {
      // eslint-disable-next-line
      callback('Name is reserved');
    } else {
      callback();
    }
  };

  validatePositiveNumber = (rule, value, callback) => {
    if (value && +value > 0 && Number.isInteger(+value) && `${value}` === `${+value}`) {
      callback();
    } else {
      // eslint-disable-next-line
      callback('Please enter positive number');
    }
  };

  rebuildParameters = {
    [PARAMETERS]: true,
    [SYSTEM_PARAMETERS]: true
  };

  loadCurrentProject = async () => {
    const folderProjectRequest =
      new FolderProject(this.props.configurationId, 'CONFIGURATION');
    await folderProjectRequest.fetch();
    if (folderProjectRequest.error) {
      message.error(folderProjectRequest.error, 5);
    } else {
      if (folderProjectRequest.value) {
        const currentProjectId = folderProjectRequest.value.id;
        const currentProjectMetadata = folderProjectRequest.value.data;
        const metadataEntityFieldsRequest =
          new MetadataEntityFields(currentProjectId);
        await metadataEntityFieldsRequest.fetch();
        if (metadataEntityFieldsRequest.error) {
          message.error(metadataEntityFieldsRequest.error, 5);
        } else {
          const currentMetadataEntity = metadataEntityFieldsRequest.value || [];
          const [currentConfiguration] =
            this.props.configurations.filter(config =>
              config.name === this.props.currentConfigurationName);
          let rootEntityId = '';
          if (currentConfiguration.rootEntityId) {
            const entity = currentMetadataEntity.find(
              entity => entity.metadataClass &&
                `${entity.metadataClass.id}` === `${currentConfiguration.rootEntityId}`
            );
            if (entity) {
              rootEntityId = `${currentConfiguration.rootEntityId}`;
            }
          }

          this.setState({
            currentMetadataEntity,
            rootEntityId,
            currentProjectMetadata,
            currentProjectId
          });
        }
      }
    }
  };

  isSystemParameter = (parameter) => {
    if (this.props.runDefaultParameters.loaded) {
      return (this.props.runDefaultParameters.value || [])
        .filter(p => p.name.toUpperCase() === (parameter.name || '').toUpperCase()).length > 0;
    }
    return false;
  };

  @computed
  get authenticatedUserRolesNames () {
    if (!this.props.authenticatedUserInfo.loaded) {
      return [];
    }
    const {
      roles = []
    } = this.props.authenticatedUserInfo.value;
    return roles.map(r => r.name);
  }

  @computed
  get isAdmin () {
    if (!this.props.authenticatedUserInfo.loaded) {
      return false;
    }
    const {
      admin
    } = this.props.authenticatedUserInfo.value;
    return admin;
  }

  isSystemParameterRestrictedByRole = (parameter) => {
    if (
      parameter &&
      this.isSystemParameter(parameter) &&
      !this.isAdmin
    ) {
      const [systemParam] = (this.props.runDefaultParameters.value || [])
        .filter(p => p.name.toUpperCase() === (parameter.name || '').toUpperCase());
      if (systemParam && systemParam.roles && systemParam.roles.length > 0) {
        return !(
          systemParam.roles
            .some(roleName => this.authenticatedUserRolesNames.includes(roleName))
        );
      }
    }
    return false;
  };

  getSystemParameter = (parameter) => {
    if (parameter && parameter.name && this.props.runDefaultParameters.loaded) {
      return (this.props.runDefaultParameters.value || [])
        .filter(p => p.name === parameter.name)[0];
    }
    return null;
  };

  onChangeRootEntity = (rootEntityId = null) => {
    this.setState({rootEntityId}, this.formFieldsChanged);
  };

  openSystemParameterBrowser = () => {
    this.setState({systemParameterBrowserVisible: true});
  };

  closeSystemParameterBrowser = () => {
    this.setState({systemParameterBrowserVisible: false});
  };

  renderParameters = (isSystemParametersSection) => {
    const sectionName = isSystemParametersSection ? SYSTEM_PARAMETERS : PARAMETERS;
    if (
      (!this.props.runDefaultParameters.loaded && this.props.runDefaultParameters.pending) ||
      (!this.props.preferences.loaded && this.props.preferences.pending)
    ) {
      return null;
    }
    let parameters;
    if (this.rebuildParameters[sectionName]) {
      parameters = this.buildDefaultParameters(isSystemParametersSection);
      this.rebuildParameters[sectionName] = false;
    } else {
      parameters = this.getSectionValue(sectionName) ||
        this.buildDefaultParameters(isSystemParametersSection);
    }

    const keysFormItem = this.props.isDetachedConfiguration &&
    this.props.selectedPipelineParametersIsLoading
      ? null
      : (
        <FormItem
          key="params_keys"
          className={styles.hiddenItem}
          required
          hasFeedback>
          {this.getSectionFieldDecorator(sectionName)('keys',
            {
              initialValue: parameters.keys
            })(<Input disabled={this.props.readOnly && !this.props.canExecute} />)}
        </FormItem>
      );
    const onSelect = ({key}) => {
      this.addParameter(
        sectionName,
        {type: key, defaultValue: key === 'boolean' ? 'true' : undefined},
        isSystemParametersSection
      );
    };

    const parameterTypeMenu = (
      <Menu selectedKeys={[]} onClick={onSelect} className={styles.parametersMenu}>
        <MenuItem id="add-string-parameter" key="string">String parameter</MenuItem>
        <MenuItem id="add-boolean-parameter" key="boolean">Boolean parameter</MenuItem>
        <MenuItem id="add-path-parameter" key="path">Path parameter</MenuItem>
        <MenuItem id="add-input-parameter" key="input">Input path parameter</MenuItem>
        <MenuItem id="add-output-parameter" key="output">Output path parameter</MenuItem>
        <MenuItem id="add-common-parameter" key="common">Common path parameter</MenuItem>
      </Menu>
    );

    const addParameterButtonFn = () => {
      if (isSystemParametersSection) {
        const notToShowSystemParametersFn = (section, isSystem) => {
          const sectionValue = this.getSectionValue(section) ||
            this.buildDefaultParameters(isSystem);
          return sectionValue && sectionValue.params && sectionValue.keys
            ? sectionValue.keys
              .map(key => sectionValue.params[key])
              .filter(param => !!param).map(p => p.name)
            : [];
        };
        return (
          <Row
            style={{marginTop: 20}}
            key="add parameter"
            type="flex"
            justify="space-around">
            <Button
              disabled={(this.props.readOnly && !this.props.canExecute) ||
              (!!this.state.pipeline && this.props.detached)}
              id="add-system-parameter-button"
              onClick={this.openSystemParameterBrowser}>
              Add system parameter
            </Button>
            <SystemParametersBrowser
              visible={this.state.systemParameterBrowserVisible}
              onCancel={this.closeSystemParameterBrowser}
              onSave={(parameters) => {
                // add selected parameters on ok
                parameters.forEach((parameter) => {
                  parameter.type = parameter.type.toLowerCase();
                  this.addParameter(sectionName, parameter, isSystemParametersSection);
                });
                this.closeSystemParameterBrowser();
              }}
              notToShow={[
                ...notToShowSystemParametersFn(PARAMETERS, false),
                ...notToShowSystemParametersFn(SYSTEM_PARAMETERS, true),
                CP_CAP_LIMIT_MOUNTS, ...getSkippedSystemParametersList(this)]
              }
            />
          </Row>
        );
      } else {
        return (
          <Row
            style={{marginTop: 20}}
            key="add parameter"
            type="flex"
            justify="space-around">
            <Button.Group>
              <Button
                disabled={(this.props.readOnly && !this.props.canExecute) ||
                (!!this.state.pipeline && this.props.detached)}
                id="add-parameter-button"
                onClick={
                  () => this.addParameter(sectionName, {type: 'string'}, isSystemParametersSection)
                }>
                Add parameter
              </Button>
              {
                !(this.props.readOnly && !this.props.canExecute) &&
                !(this.state.pipeline && this.props.detached)
                  ? (
                    <Dropdown overlay={parameterTypeMenu} placement="bottomRight">
                      <Button
                        id="add-parameter-dropdown-button"
                        disabled={this.props.readOnly && !this.props.canExecute}
                        style={{padding: '0px 8px'}}
                      >
                        <Icon type="down" />
                      </Button>
                    </Dropdown>
                  ) : undefined
              }
            </Button.Group>
          </Row>
        );
      }
    };

    const renderRootEntity = () => {
      return this.state.currentMetadataEntity.length > 0 && (
        <FormItem
          key="root_entity_type_select"
          className={`${styles.formItemRow} ${styles.rootEntityTypeContainer} root_entity`}>
          <Row
            style={{marginTop: 10}}
            key="root_entity_type_row"
            align="middle"
            type="flex">
            <Col span={4} offset={isSystemParametersSection ? 1 : 2}>Root entity type:</Col>
            <Col
              key="root_entity_type"
              span={isSystemParametersSection ? 16 : 15}>
              <Select
                allowClear
                value={this.state.rootEntityId}
                onChange={this.onChangeRootEntity}
                placeholder="Select root entity type">
                {this.state.currentMetadataEntity.map(entity => {
                  return (
                    <Select.Option key={entity.metadataClass.id}>
                      {entity.metadataClass.name}
                    </Select.Option>
                  );
                })}
              </Select>
            </Col>
          </Row>
        </FormItem>
      );
    };

    const renderUseResolvedParameters = () => {
      const resolvedParameters = Object.values(parameters?.params || {})
        .filter(parameter => parameter.hasResolvedValue);
      if (!resolvedParameters.length) {
        return null;
      }
      return (
        <Row
          type="flex"
          style={{
            marginBottom: '10px'
          }}
          key="use-resolved-parameters_row"
        >
          <Col
            span={isSystemParametersSection ? 16 : 15}
            offset={isSystemParametersSection ? 4 : 6}
            style={{
              textAlign: 'right'
            }}
          >
            <Checkbox
              checked={this.state.useResolvedParameters}
              onChange={this.toggleResolvedParameters}
              style={{
                userSelect: 'none'
              }}
            >
              Use resolved values
            </Checkbox>
          </Col>
        </Row>
      );
    };

    const renderCurrentParameters = (isSystem = false) => {
      if (this.props.isDetachedConfiguration && this.props.selectedPipelineParametersIsLoading) {
        return [];
      } else {
        const normalizedParameters = parameterUtilities.normalizeParameters(parameters);
        const renderParametersGroup = (keys, params) => keys.map(key => {
          const parameter = (params ? params[key] : undefined) ||
            this.addedParameters[key];
          let name = parameter ? parameter.name : '';
          let value = parameter ? parameter.value : '';
          const resolvedValue = parameter ? parameter.resolvedValue : '';
          const hasResolvedValue = parameter ? parameter.hasResolvedValue : false;
          let type = parameter ? parameter.type : 'string';
          let readOnly = parameter ? parameter.readOnly : false;
          const restrictedSystemParameter = this.isSystemParameterRestrictedByRole(parameter);
          const removeAllowed = !isSystemParametersSection ||
            !restrictedSystemParameter;
          if (parameter && parameter.initial) {
            readOnly = readOnly || restrictedSystemParameter;
          }
          const noOverride = parameter ? parameter.noOverride : false;
          const systemParameterValueIsBlocked = isSystemParametersSection &&
            getSystemParameterDisabledState(this, name);
          let required = parameter ? `${parameter.required}` === 'true' : false;
          let enumeration = parameter ? parameter.enumeration : undefined;
          const initialEnumeration = parameter ? parameter.initialEnumeration : undefined;
          let description = parameter ? parameter.description : undefined;
          let section = parameter ? parameter.section : OTHER_PARAMETERS_GROUP;
          let visible = parameter ? parameter.visible : undefined;
          let validation = parameter ? parameter.validation : undefined;
          const validator = validation
            ? (rule, value, callback) => {
              const formParameters = this.getSectionValue(sectionName) ||
                this.buildDefaultParameters(isSystemParametersSection);
              const modifiedParameters = {
                ...parameterUtilities.normalizeParameters(formParameters)
              };
              if (modifiedParameters.hasOwnProperty(name)) {
                modifiedParameters[name].value = value;
              }
              callback(parameterUtilities.validate(parameter, modifiedParameters));
            }
            : undefined;
          const parameterIsVisible = parameterUtilities.isVisible(parameter, normalizedParameters);
          const systemParameter = this.getSystemParameter(parameter);
          const parameterHint = systemParameter ? systemParameter.description : description;
          const parameterHintFn = parameterHint
            ? () => { return parameterHint; } : undefined;
          let formItem;
          switch (type.toLowerCase()) {
            case 'path':
            case 'output':
            case 'input':
            case 'common':
              formItem = this.renderPathParameter(
                sectionName,
                {key, value, required, readOnly, description, validator},
                type,
                isSystemParametersSection,
                parameterIsVisible
              );
              break;
            case 'boolean':
              formItem = this.renderBooleanParameter(
                sectionName,
                {key, value, readOnly, description, validator}
              );
              break;
            default:
              if (enumeration) {
                formItem = this.renderSelectionParameter(
                  sectionName,
                  {key, value, required, readOnly, enumeration, description, validator},
                  isSystemParametersSection,
                  normalizedParameters
                );
              } else {
                formItem = this.renderStringParameter(
                  sectionName,
                  {key, value, required, readOnly, description, validator},
                  isSystemParametersSection,
                  parameterIsVisible
                );
              }
              break;
          }
          const nameDisabled = (this.props.readOnly && !this.props.canExecute) ||
            required || isSystemParametersSection ||
            (!!this.state.pipeline && this.props.detached);
          return (
            <FormItem
              key={key}
              className={
                getFormItemClassName(
                  parameterIsVisible
                    ? styles.formItemRow
                    : `${styles.formItemRow} ${styles.hiddenItem}`,
                  key
                )
              }
              {...this.parameterItemLayout}
              hasFeedback>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.readOnly`,
                    {initialValue: readOnly}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.noOverride`,
                    {initialValue: noOverride}
                  )(<Input disabled />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.key`,
                    {initialValue: key}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.type`,
                    {initialValue: type}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.enumeration`,
                    {initialValue: enumeration}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.initialEnumeration`,
                    {initialValue: initialEnumeration}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.visible`,
                    {initialValue: visible}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.validation`,
                    {initialValue: validation}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.required`,
                    {initialValue: `${required}`}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.resolvedValue`,
                    {initialValue: resolvedValue}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.hasResolvedValue`,
                    {initialValue: hasResolvedValue}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.description`,
                    {initialValue: description}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <FormItem className={styles.hiddenItem}>
                {
                  this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.section`,
                    {initialValue: section}
                  )(<Input disabled={this.props.readOnly && !this.props.canExecute} />)
                }
              </FormItem>
              <Col
                span={4}
                className={systemParameterValueIsBlocked ? styles.hiddenItem : undefined}
                offset={isSystemParametersSection ? 0 : 2}>
                <FormItem
                  className={styles.formItemRow}
                  required={required && parameterIsVisible}>
                  {this.getSectionFieldDecorator(sectionName)(
                    `params.${key}.name`,
                    {
                      rules: [
                        {
                          required: parameterIsVisible,
                          message: 'Required'
                        },
                        {
                          pattern: /^[\da-zA-Z_]+$/,
                          message: 'Name can contain only letters, digits and \'_\'.'
                        },
                        {
                          validator: this.validateParameterName(
                            sectionName,
                            key,
                            isSystemParametersSection
                          )
                        }],
                      initialValue: name
                    }
                  )(
                    <Input
                      disabled={nameDisabled}
                      placeholder="Name"
                      className={
                        classNames(
                          'cp-parameter-name',
                          {
                            [styles.parameterName]: !isSystemParametersSection,
                            [styles.systemParameterName]: isSystemParametersSection,
                            disabled: nameDisabled,
                            'cp-system-parameter-name-input': isSystemParametersSection
                          }
                        )
                      } />
                  )}
                </FormItem>
              </Col>
              <Col
                span={isSystemParametersSection ? 16 : 15}
                className={systemParameterValueIsBlocked ? styles.hiddenItem : undefined}>
                {formItem}
              </Col>
              <Col
                span={3}
                className={
                  systemParameterValueIsBlocked
                    ? styles.hiddenItem
                    : styles.removeParameter
                }>
                {
                  !required &&
                  !(this.props.readOnly && !this.props.canExecute) &&
                  !(this.state.pipeline && this.props.detached) &&
                  removeAllowed
                    ? (
                      <Icon
                        id="remove-parameter-button"
                        className="dynamic-delete-button"
                        type="minus-circle-o"
                        onClick={() => this.removeParameter(sectionName, key)}
                        style={{marginLeft: 15, width: 15}}
                      />
                    ) : (
                      <div
                        style={{
                          marginLeft: 15,
                          width: 15,
                          display: 'inline-block'
                        }}>{'\u00A0'}</div>
                    )
                }
                {
                  parameterHintFn &&
                  hints.renderHint(
                    this.localizedStringWithSpotDictionaryFn,
                    parameterHintFn,
                    null,
                    {marginLeft: 15}
                  )
                }
              </Col>
            </FormItem>
          );
        }).filter(parameter => !!parameter);
        const {keys, params} = parameters;
        if (isSystem) {
          return renderParametersGroup(keys, params);
        } else {
          const sectionNames = keys.reduce((result, key) => {
            const parameter = (params && params[key]) || this.addedParameters[key];
            const section = parameter
              ? parameter.section
              : OTHER_PARAMETERS_GROUP;
            if (result.includes(section)) {
              return result;
            }
            return [...result, section];
          }, []);
          const paramsPerSection = keys.reduce((result, key) => {
            const parameter = (params && params[key]) || this.addedParameters[key];
            const section = parameter
              ? parameter.section
              : OTHER_PARAMETERS_GROUP;
            result[section] = {...result[section], [key]: {...parameter}};
            return result;
          }, {});
          const sectionVisible = section => {
            const keys = Object.keys(paramsPerSection[section]);
            const params = paramsPerSection[section];
            return keys.some(key => {
              const parameter = (params ? params[key] : undefined) ||
                this.addedParameters[key];
              return parameterUtilities.isVisible(parameter, normalizedParameters);
            });
          };
          const containsOtherGroup = sectionNames.includes(OTHER_PARAMETERS_GROUP);
          const sortedKeys = sectionNames.filter(key => key !== OTHER_PARAMETERS_GROUP);
          const sections = sortedKeys
            .concat(containsOtherGroup ? [OTHER_PARAMETERS_GROUP] : []);
          return sections.length > 1
            ? sections.map(section => {
              return (
                <div key={section}>
                  {
                    this.renderSeparator(
                      section.toUpperCase(),
                      0,
                      'section',
                      Object.assign(
                        {marginTop: 20, marginBottom: 20},
                        sectionVisible(section) ? {} : {display: 'none'}
                      )
                    )}
                  {
                    renderParametersGroup(
                      Object.keys(paramsPerSection[section]),
                      paramsPerSection[section])
                  }
                </div>
              );
            })
            : renderParametersGroup(keys, params);
        }
      }
    };

    const currentParameters = this.isFireCloudSelected
      ? []
      : renderCurrentParameters(isSystemParametersSection);

    return [
      renderUseResolvedParameters(),
      this.props.isDetachedConfiguration && !isSystemParametersSection && renderRootEntity(),
      isSystemParametersSection && currentParameters.length > 0 &&
      this.renderSeparator('System parameters', 0, 'header', {marginTop: 20, marginBottom: 10}),
      !this.isFireCloudSelected ? keysFormItem : undefined,
      ...currentParameters,
      !this.isFireCloudSelected ? addParameterButtonFn() : undefined
    ];
  };

  @computed
  get multiplyValueBy () {
    if (this.state.launchCluster) {
      return (this.state.nodesCount || 0) + 1;
    } else {
      return 1;
    }
  }

  @computed
  get maxMultiplyValueBy () {
    if (this.state.launchCluster) {
      let value = this.state.maxNodesCount;
      if (!value || isNaN(value)) {
        value = 1;
      } else {
        value = +value;
      }
      return value + 1;
    } else {
      return 1;
    }
  }

  renderDockerImageFormItem = () => {
    return (
      <FormItem
        className={getFormItemClassName(styles.formItem, 'dockerImage')}
        {...this.formItemLayout}
        label="Docker image"
        required={!this.state.fireCloudMethodName}
        hasFeedback>
        {this.getSectionFieldDecorator(EXEC_ENVIRONMENT)('dockerImage',
          {
            rules: [
              {
                required: !this.state.fireCloudMethodName,
                message: 'Docker image is required'
              }
            ],
            initialValue: this.getDefaultValue('docker_image')
          }
        )(
          <DockerImageInput disabled={
            !!this.state.fireCloudMethodName ||
            (this.props.readOnly && !this.props.canExecute) ||
            (this.state.pipeline && this.props.detached)} />
        )}
      </FormItem>
    );
  };

  @computed
  get disableAutoPauseEnabled () {
    return !this.state.fireCloudMethodName &&
      !this.props.detached &&
      !this.props.editConfigurationMode;
  }

  @computed
  get prettyUrlEnabled () {
    if (this.state.fireCloudMethodName || this.props.detached) {
      return undefined;
    }
    const dockerImage = this.getSectionFieldValue(EXEC_ENVIRONMENT)('dockerImage') ||
      this.getDefaultValue('docker_image');
    if (dockerImage && this.props.dockerRegistries.loaded) {
      const [registry, group, toolAndVersion] = dockerImage.toLowerCase().split('/');
      const [imageRegistry] = (this.props.dockerRegistries.value.registries || [])
        .filter(r => r.path.toLowerCase() === registry);
      if (imageRegistry) {
        const [imageGroup] = (imageRegistry.groups || [])
          .filter(g => g.name.toLowerCase() === group);
        if (imageGroup) {
          const [image] = toolAndVersion.split(':');
          const [im] = (imageGroup.tools || [])
            .filter(i => i.image.toLowerCase() === `${group}/${image}`);
          return im && im.endpoints && (im.endpoints || []).length > 0;
        }
      }
    }
    return false;
  }

  checkFriendlyURL = (rule, value, callback) => {
    const error = prettyUrlGenerator.validate(value);
    if (error) {
      callback(error);
    }
    callback();
  };

  renderPrettyUrlFormItem = () => {
    if (this.prettyUrlEnabled && this.friendlyUrlAvailable()) {
      return (
        <FormItem
          className={getFormItemClassName(styles.formItemRow, 'prettyUrl')}
          {...this.leftFormItemLayout}
          label="Friendly URL"
          hasFeedback>
          <Col span={10}>
            <FormItem
              className={styles.formItemRow}
              hasFeedback
            >
              {this.getSectionFieldDecorator(ADVANCED)('prettyUrl',
                {
                  rules: [
                    {
                      validator: this.checkFriendlyURL
                    }
                  ],
                  initialValue: prettyUrlGenerator.parse(this.getDefaultValue('prettyUrl'))
                }
              )(
                <Input
                  disabled={(this.props.readOnly && !this.props.canExecute)} />
              )}
            </FormItem>
          </Col>
          <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
            {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.prettyUrlHint)}
          </Col>
        </FormItem>
      );
    }
    return undefined;
  };

  renderEndpointNameFormItem = () => {
    if (this.props.detached && this.props.editConfigurationMode) {
      return (
        <FormItem
          className={getFormItemClassName(styles.formItemRow, 'endpointName')}
          {...this.leftFormItemLayout}
          label="Endpoint Name"
          hasFeedback>
          <Col span={10}>
            <FormItem
              className={styles.formItemRow}
              hasFeedback
            >
              {this.getSectionFieldDecorator(ADVANCED)('endpointName',
                {
                  initialValue: this.getDefaultValue('endpointName')
                }
              )(
                <Input
                  disabled={(this.props.readOnly && !this.props.canExecute)} />
              )}
            </FormItem>
          </Col>
          <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
            {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.endpointNameHint)}
          </Col>
        </FormItem>
      );
    }
    return undefined;
  };

  cpuMapper = cpu => this.hyperThreadingDisabled && !Number.isNaN(Number(cpu))
    ? (cpu / 2.0)
    : cpu;

  renderInstanceTypeSelection = () => {
    if (this.state.isDts && this.props.detached) {
      return undefined;
    }
    const instanceTypeStr = (t) => ([
      `${t.name} (CPU: ${this.cpuMapper(t.vcpu)}, `,
      `RAM: ${t.memory}${t.gpu ? `, GPU: ${t.gpu}` : ''})`
    ]).join('');
    return (
      <FormItem
        className={getFormItemClassName(styles.formItem, 'type')}
        {...this.formItemLayout}
        required={!this.state.fireCloudMethodName && !this.state.isDts}
        label="Node type"
        hasFeedback>
        {this.getSectionFieldDecorator(EXEC_ENVIRONMENT)('type',
          {
            rules: [
              {
                required: !this.state.fireCloudMethodName && !this.state.isDts,
                message: 'Node type is required'
              }
            ],
            initialValue: this.correctInstanceTypeValue(this.getDefaultValue('instance_size'))
          }
        )(
          <Select
            disabled={
              !!this.state.fireCloudMethodName ||
              (this.props.readOnly && !this.props.canExecute) ||
              (
                this.props.allowedInstanceTypes &&
                (this.props.allowedInstanceTypes.changed || this.props.allowedInstanceTypes.pending)
              )}
            showSearch
            allowClear={false}
            placeholder="Node type"
            optionFilterProp="children"
            onChange={this.instanceTypeChanged}
            filterOption={
              (input, option) =>
                option.props.value.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
            {
              this.instanceTypes
                .map(t => t.instanceFamily)
                .filter((familyName, index, array) => array.indexOf(familyName) === index)
                .map(instanceFamily => {
                  return (
                    <Select.OptGroup
                      key={instanceFamily || 'Other'}
                      label={instanceFamily || 'Other'} >
                      {
                        this.instanceTypes
                          .filter(t => t.instanceFamily === instanceFamily)
                          .map(t =>
                            <Select.Option
                              key={t.sku}
                              value={t.name}
                              title={instanceTypeStr(t)}
                            >
                              {instanceTypeStr(t)}
                            </Select.Option>
                          )
                      }
                    </Select.OptGroup>
                  );
                })
            }
          </Select>
        )}
      </FormItem>
    );
  };

  resetToolSettings = () => {
    this._toolSettings = null;
    this.regionDisabledByToolSettings = false;
    this.toolCloudRegion = null;
    this.toolPlatform = null;
    this.toolAllowSensitive = true;
    this.toolDefaultCmd = undefined;
    this.setState({
      useDefaultCmd: false
    });
  };

  lastConfirmedImage;

  loadToolSettings = async (dockerImage) => {
    await this.props.dockerRegistries.fetchIfNeededOrWait();
    if (this.props.dockerRegistries.loaded) {
      const [registry, group, toolAndVersion] = dockerImage.toLowerCase().split('/');
      const [imageRegistry] = (this.props.dockerRegistries.value.registries || [])
        .filter(r => r.path.toLowerCase() === registry);
      if (imageRegistry) {
        const [imageGroup] = (imageRegistry.groups || [])
          .filter(g => g.name.toLowerCase() === group);
        if (imageGroup) {
          const [image, version] = toolAndVersion.split(':');
          const [im] = (imageGroup.tools || [])
            .filter(i => i.image.toLowerCase() === `${group}/${image}`);
          if (im && im.id) {
            this.toolAllowSensitive = im.allowSensitive;
            this.toolPlatform = im.platform;
            this._toolSettings = new LoadToolVersionSettings(im.id, version);
            await this._toolSettings.fetchIfNeededOrWait();

            if (this._toolSettings && this._toolSettings.loaded && this._toolSettings.value &&
              this._toolSettings.value[0] && this._toolSettings.value[0].settings &&
              this._toolSettings.value[0].settings[0].configuration &&
              this._toolSettings.value[0].settings[0].configuration.cloudRegionId) {
              this.regionDisabledByToolSettings = true;
              this.toolCloudRegion = `${
                this._toolSettings.value[0].settings[0].configuration.cloudRegionId
              }`;
            } else {
              this.regionDisabledByToolSettings = false;
              this.toolCloudRegion = null;
            }

            const defaultCmdRequest = new ToolDefaultCommand(im.id, version);
            await defaultCmdRequest.fetch();
            if (defaultCmdRequest.loaded) {
              this.toolDefaultCmd = defaultCmdRequest.value;
              const advancedValues = this.getSectionValue(ADVANCED) || {};
              const cmd = (advancedValues.cmdTemplate || this.getDefaultValue('cmd_template'));
              const useDefaultCmd = cmd === this.toolDefaultCmd;
              if (useDefaultCmd) {
                this.setState({
                  useDefaultCmd: true,
                  startIdle: false
                }, this.formFieldsChanged);
              } else {
                this.setState({
                  useDefaultCmd: false
                }, this.formFieldsChanged);
              }
            } else {
              this.toolDefaultCmd = undefined;
            }
          } else {
            this.toolAllowSensitive = true;
          }
        } else {
          this.toolAllowSensitive = true;
        }
      } else {
        this.toolAllowSensitive = true;
      }
    }
  };

  getDefaultCloudRegionValue = () => {
    if (this.toolCloudRegion) {
      return this.toolCloudRegion;
    }

    return this.getDefaultValue('cloudRegionId') || this.defaultCloudRegionId;
  };

  getInitialCloudRegionNotAvailable = () => {
    const {getFieldValue} = this.props.form;
    const initialValue = `${this.getDefaultCloudRegionValue()}`;
    const currentValue = getFieldValue(`${EXEC_ENVIRONMENT}.cloudRegionId`);
    return (!currentValue || currentValue === initialValue) &&
      initialValue &&
      this.awsRegions.filter((region) => `${region.id}` === initialValue).length === 0;
  };

  renderAWSRegionSelection = () => {
    if (this.state.isDts && this.props.detached) {
      return undefined;
    }
    return (
      <FormItem
        className={getFormItemClassName(styles.formItem, 'cloudRegionId')}
        {...this.formItemLayout}
        required={this.awsRegions.length > 0 && !this.state.isDts}
        hasFeedback
        label="Cloud Region">
        {this.getSectionFieldDecorator(EXEC_ENVIRONMENT)('cloudRegionId',
          {
            rules: [
              {
                required: this.awsRegions.length > 0 && !this.state.isDts,
                message: 'Cloud region id is required'
              }
            ],
            initialValue: this.getDefaultCloudRegionValue()
          }
        )(
          <Select
            disabled={
              this.regionDisabledByToolSettings ||
              !!this.state.fireCloudMethodName ||
              (this.props.readOnly && !this.props.canExecute) ||
              (
                this.props.allowedInstanceTypes &&
                (this.props.allowedInstanceTypes.changed || this.props.allowedInstanceTypes.pending)
              )
            }
            showSearch
            allowClear={false}
            placeholder="Cloud Region"
            optionFilterProp="children"
            onSelect={(cloudRegionId) => this.evaluateEstimatedPrice({cloudRegionId})}
            filterOption={
              (input, option) =>
                option.props.name.toLowerCase().indexOf(input.toLowerCase()) >= 0}>
            {
              this.getInitialCloudRegionNotAvailable() && (
                <Select.Option
                  key={this.getDefaultCloudRegionValue()}
                  name="Not available"
                  title="Not available"
                  value={this.getDefaultCloudRegionValue()}
                >
                  Not available
                </Select.Option>
              )
            }
            {
              this.awsRegions
                .map(region => {
                  return (
                    <Select.Option
                      key={`${region.id}`}
                      name={region.name}
                      title={region.name}
                      value={`${region.id}`}>
                      <AWSRegionTag
                        provider={region.provider}
                        regionUID={region.regionId}
                        style={{fontSize: 'larger'}}
                      /> {region.name}
                    </Select.Option>
                  );
                })
            }
          </Select>
        )}
      </FormItem>
    );
  };

  openConfigureClusterDialog = () => {
    this.setState({
      configureClusterDialogVisible: true
    });
  };

  closeConfigureClusterDialog = () => {
    this.setState({
      configureClusterDialogVisible: false
    }, this.formFieldsChanged);
  };

  onChangeClusterConfiguration = (configuration) => {
    setClusterParameterValue(this.props.form, SYSTEM_PARAMETERS, configuration);
    const {
      launchCluster,
      autoScaledCluster,
      hybridAutoScaledClusterEnabled,
      gpuScalingConfiguration,
      nodesCount,
      maxNodesCount,
      gridEngineEnabled,
      sparkEnabled,
      slurmEnabled,
      kubeEnabled,
      autoScaledPriceType
    } = configuration;
    let {runCapabilities} = this.state;
    if (kubeEnabled) {
      runCapabilities = addCapability(
        runCapabilities,
        RUN_CAPABILITIES.dinD,
        RUN_CAPABILITIES.systemD
      );
    }
    this.setState({
      launchCluster,
      autoScaledCluster,
      hybridAutoScaledClusterEnabled,
      gpuScalingConfiguration,
      gridEngineEnabled,
      sparkEnabled,
      slurmEnabled,
      kubeEnabled,
      nodesCount,
      maxNodesCount,
      autoScaledPriceType,
      runCapabilities
    }, () => {
      this.closeConfigureClusterDialog();
      const priceType = this.getSectionFieldValue(ADVANCED)('is_spot') ||
        this.getDefaultValue('is_spot');
      const priceTypeField = `${ADVANCED}.is_spot`;
      this.props.form.setFieldsValue({
        [priceTypeField]: this.correctPriceTypeValue(priceType)
      });
    });
  };

  renderExecutionEnvironmentSummary = () => {
    const instanceTypeValue = this.getSectionFieldValue(EXEC_ENVIRONMENT)('type');
    const [instanceType] = this.instanceTypes.filter(t => t.name === instanceTypeValue);
    let cpu = 0;
    let ram = 0;
    let gpu = 0;
    if (instanceType) {
      cpu = +(instanceType.vcpu || 0);
      gpu = +(instanceType.gpu || 0);
      ram = +(instanceType.memory || 0);
    }
    let disk = +(this.getSectionFieldValue(EXEC_ENVIRONMENT)('disk') || 0);
    let maxCPU = cpu;
    let maxRAM = ram;
    let maxGPU = gpu;
    let maxDISK = disk;
    if (this.state.launchCluster && !this.state.fireCloudMethodName) {
      cpu *= this.multiplyValueBy;
      gpu *= this.multiplyValueBy;
      ram *= this.multiplyValueBy;
      disk *= this.multiplyValueBy;
      if (this.state.autoScaledCluster) {
        maxCPU *= this.maxMultiplyValueBy;
        maxGPU *= this.maxMultiplyValueBy;
        maxRAM *= this.maxMultiplyValueBy;
        maxDISK *= this.maxMultiplyValueBy;
      } else {
        maxCPU = maxRAM = maxGPU = maxDISK = 0;
      }
    } else {
      maxCPU = maxRAM = maxGPU = maxDISK = 0;
    }
    const lines = [];
    if (cpu) {
      maxCPU && maxCPU > cpu
        ? lines.push(<span>{this.cpuMapper(cpu)} - {this.cpuMapper(maxCPU)} <b>CPU</b></span>)
        : lines.push(<span>{this.cpuMapper(cpu)} <b>CPU</b></span>);
    }
    if (ram) {
      maxRAM && maxRAM > ram
        ? lines.push(<span>{ram} - {maxRAM} <b>RAM</b></span>)
        : lines.push(<span>{ram} <b>RAM</b></span>);
    }
    if (gpu) {
      maxGPU && maxGPU > gpu
        ? lines.push(<span>{gpu} - {maxGPU} <b>GPU</b></span>)
        : lines.push(<span>{gpu} <b>GPU</b></span>);
    }
    if (disk) {
      maxDISK && maxDISK > disk
        ? lines.push(<span>{disk} - {maxDISK} <b>Gb</b></span>)
        : lines.push(<span>{disk} <b>Gb</b></span>);
    }
    if (lines.length > 0) {
      return [
        <div key="summary" className={styles.summaryContainer}>
          <div className={classNames(styles.summary, 'cp-exec-env-summary')}>
            {
              lines.map((l, index) => (
                <div
                  key={index}
                  className={classNames(
                    styles.summaryItem,
                    'cp-exec-env-summary-item'
                  )}
                >
                  {l}
                </div>
              ))
            }
          </div>
        </div>,
        <div key="hint" style={{width: 30, textAlign: 'center'}}>
          {hints.renderHint(
            this.localizedStringWithSpotDictionaryFn,
            hints.executionEnvironmentSummaryHint
          )}
        </div>
      ];
    } else {
      return null;
    }
  };

  renderDiskFormItem = () => {
    if (this.state.isDts && this.props.detached) {
      return undefined;
    }
    return (
      <FormItem
        className={getFormItemClassName(styles.formItem, 'disk')}
        {...this.formItemLayout}
        label="Disk (Gb)"
        required={!this.state.fireCloudMethodName && !this.state.isDts}
        hasFeedback>
        {this.getSectionFieldDecorator(EXEC_ENVIRONMENT)('disk',
          {
            rules: [
              {
                pattern: /^\d+(\.\d+)?$/,
                message: 'Please enter a valid positive number'
              },
              {
                required: !this.state.fireCloudMethodName &&
                  !this.state.isDts,
                message: 'Instance disk is required'
              },
              {
                validator: (rule, value, callback) => {
                  if (!!this.state.fireCloudMethodName || this.state.isDts) {
                    callback();
                    return;
                  }
                  if (!isNaN(value)) {
                    if (+value > 15360) {
                      // eslint-disable-next-line
                      callback('Maximum value is 15360');
                      return;
                    } else if (+value < 15) {
                      // eslint-disable-next-line
                      callback('Minimum value is 15');
                      return;
                    }
                  }
                  callback();
                }
              }
            ],
            initialValue: this.getDefaultValue('instance_disk')
          }
        )(
          <Input
            disabled={
              !!this.state.fireCloudMethodName ||
              (this.props.readOnly && !this.props.canExecute)
            }
            onChange={this.diskSizeChanged} />
        )}
      </FormItem>
    );
  };

  correctInstanceTypeValue = (value) => {
    if (value !== undefined && value !== null && this.instanceTypesLoaded) {
      const v = this.instanceTypes.find(v => v.name === value);
      if (v !== undefined) {
        return v.name;
      }
      return null;
    }
    return value;
  };

  correctPriceTypeValue = (value) => {
    if (value !== undefined && value !== null) {
      let realValue = `${value}` === 'true';
      const [v] = this.priceTypes.filter(v => v === realValue);
      if (v !== undefined) {
        return `${v}`;
      } else if (this.priceTypes.length > 0) {
        return `${this.priceTypes[0]}`;
      } else {
        return undefined;
      }
    }
    return value;
  };

  correctAllowedInstanceValues = () => {
    const instanceType = this.getSectionFieldValue(EXEC_ENVIRONMENT)('type') ||
      this.getDefaultValue('instance_size');
    const priceType = this.getSectionFieldValue(ADVANCED)('is_spot') ||
      this.getDefaultValue('is_spot');
    const instanceTypeField = `${EXEC_ENVIRONMENT}.type`;
    const priceTypeField = `${ADVANCED}.is_spot`;
    this.props.form.setFieldsValue({
      [instanceTypeField]: this.correctInstanceTypeValue(instanceType),
      [priceTypeField]: this.correctPriceTypeValue(priceType)
    });
  };

  correctCloudRegion = (value) => {
    const regionId = +value;
    const [region] = this.awsRegions.filter(r => r.id === regionId);
    return region ? `${region.id}` : this.defaultCloudRegionId;
  };

  renderScheduleControl = () => {
    const {editConfigurationMode, isDetachedConfiguration} = this.props;
    const {launchCluster, scheduleRules} = this.state;
    const isSpot = `${this.getSectionFieldValue(ADVANCED)('is_spot') ||
      this.correctPriceTypeValue(this.getDefaultValue('is_spot'))}` === 'true';

    if (editConfigurationMode || isDetachedConfiguration || isSpot || launchCluster) {
      return null;
    }
    const onScheduleSubmit = (rules) => {
      const scheduleRules = rules.filter(r => !r.removed);
      this.setState({scheduleRules});
    };

    return (
      <FormItem
        className={getFormItemClassName(styles.formItemRow, 'runScheduling')}
        {...this.leftFormItemLayout}
        label="Maintenance"
        hasFeedback>
        <RunSchedulingList
          allowEdit
          onSubmit={onScheduleSubmit}
          rules={scheduleRules}
        />
      </FormItem>
    );
  };

  renderPriceTypeSelection = () => {
    if (this.state.isDts && this.props.detached) {
      return undefined;
    }
    const initialValue = this.correctPriceTypeValue(this.getDefaultValue('is_spot'));
    return (
      <FormItem
        className={getFormItemClassName(styles.formItemRow, 'is_spot')}
        {...this.leftFormItemLayout}
        label="Price type"
        hasFeedback>
        <Row type="flex" align="middle">
          <Col span={10}>
            <FormItem
              className={styles.formItemRow}
              hasFeedback>
              {this.getSectionFieldDecorator(ADVANCED)('is_spot',
                {
                  rules: [
                    {
                      required: !this.state.isDts,
                      message: 'Price type is required'
                    }
                  ],
                  initialValue: initialValue !== undefined && initialValue !== null
                    ? `${initialValue}`
                    : undefined
                }
              )(
                <Select
                  onSelect={(isSpot) => this.evaluateEstimatedPrice({isSpot})}
                  disabled={
                    !!this.state.fireCloudMethodName ||
                    (this.props.readOnly && !this.props.canExecute) ||
                    this.props.defaultPriceTypeIsLoading
                  }
                  allowClear={false}
                  placeholder="Price type">
                  {
                    this.priceTypes.map(p => {
                      return (
                        <Select.Option key={`${p}`} value={`${p}`}>
                          {getSpotTypeName(p, this.currentCloudRegionProvider)}
                        </Select.Option>
                      );
                    })
                  }
                </Select>
              )}
            </FormItem>
          </Col>
          <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
            {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.priceTypeHint)}
          </Col>
        </Row>
      </FormItem>
    );
  };

  renderDisableAutoPauseFormItem = () => {
    if (this.disableAutoPauseEnabled) {
      const isSpot = `${this.getSectionFieldValue(ADVANCED)('is_spot') ||
        this.correctPriceTypeValue(this.getDefaultValue('is_spot'))}` === 'true';
      const {
        autoScaledCluster,
        launchCluster
      } = this.state;
      if (!isSpot && !autoScaledCluster && !launchCluster) {
        const onChange = (e) => {
          this.setState({
            autoPause: e.target.checked
          }, this.formFieldsChanged);
        };
        return (
          <Row type="flex" align="middle" style={{marginTop: 10, marginBottom: 10}}>
            <Col
              xs={10}
              sm={5}
              md={4}
              lg={3}
              xl={2}
              className="cp-accent"
              style={{
                textAlign: 'right',
                paddingRight: 10
              }}>
              Auto pause:
            </Col>
            <Col xs={24} sm={16} md={15} lg={15} xl={10}>
              <Row type="flex" align="middle">
                <Col span={10}>
                  <Checkbox checked={this.state.autoPause} onChange={onChange}>
                    Enabled
                  </Checkbox>
                </Col>
                <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
                  {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.autoPauseHint)}
                </Col>
              </Row>
            </Col>
          </Row>
        );
      }
    }
    return null;
  };

  renderTimeoutFormItem = () => {
    if (this.state.isDts && this.props.detached) {
      return undefined;
    }
    return (
      <FormItem
        className={getFormItemClassName(styles.formItemRow, 'timeout')}
        {...this.leftFormItemLayout}
        label="Timeout (min)"
        hasFeedback>
        <Col span={10}>
          <FormItem
            className={styles.formItemRow}
            hasFeedback>
            {this.getSectionFieldDecorator(ADVANCED)('timeout',
              {
                rules: [
                  {
                    pattern: /^\d+(\.\d+)?$/,
                    message: 'Please enter a valid positive number'
                  }
                ],
                initialValue: this.getDefaultValue('timeout')
              }
            )(
              <Input
                disabled={
                  !!this.state.fireCloudMethodName ||
                  (this.props.readOnly && !this.props.canExecute)
                } />
            )}
          </FormItem>
        </Col>
        <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
          {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.timeOutHint)}
        </Col>
      </FormItem>
    );
  };

  renderStopAfterFormItem = () => {
    if (!this.props.detached || !this.props.editConfigurationMode) {
      return undefined;
    }
    return (
      <FormItem
        className={getFormItemClassName(styles.formItemRow, 'stopAfter')}
        {...this.leftFormItemLayout}
        label="Stop after (min)"
        hasFeedback>
        <Col span={10}>
          <FormItem
            className={styles.formItemRow}
            hasFeedback>
            {this.getSectionFieldDecorator(ADVANCED)('stopAfter',
              {
                rules: [
                  {
                    pattern: /^\d+(\.\d+)?$/,
                    message: 'Please enter a valid positive number'
                  }
                ],
                initialValue: this.getDefaultValue('stopAfter')
              }
            )(
              <Input
                disabled={
                  (this.props.readOnly && !this.props.canExecute)
                }
              />
            )}
          </FormItem>
        </Col>
        <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
          {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.stopAfterHint)}
        </Col>
      </FormItem>
    );
  };

  renderLimitMountsFormItem = () => {
    if (this.isWindowsPlatform) {
      return null;
    }
    const {
      dataStorageAvailable,
      currentUserAttributes
    } = this.props;
    if (dataStorageAvailable.loaded && currentUserAttributes.loaded) {
      const getDefaultValue = () => {
        if (this.props.parameters.parameters &&
          this.props.parameters.parameters[CP_CAP_LIMIT_MOUNTS]) {
          return this.props.parameters.parameters[CP_CAP_LIMIT_MOUNTS].value;
        }
        if (
          !this.props.isDetachedConfiguration &&
          !this.props.editConfigurationMode &&
          currentUserAttributes.hasAttribute(CP_CAP_LIMIT_MOUNTS)
        ) {
          return currentUserAttributes.getAttributeValue(
            CP_CAP_LIMIT_MOUNTS,
            this.toolAllowSensitive
          );
        }
        return null;
      };
      const availableMounts = new Set((dataStorageAvailable.value || []).map(d => +d.id));
      const defaultValue = (getDefaultValue() || '')
        .split(',')
        .filter(o => /^none$/i.test(o) || availableMounts.has(+o))
        .join(',') || null;
      let currentValue = this.props.form.getFieldValue(`${ADVANCED}.limitMounts`);
      if (currentValue === undefined) {
        currentValue = defaultValue;
      }
      const noStoragesSelected = /^none$/i.test(currentValue);
      const instanceType = this.getSectionFieldValue(EXEC_ENVIRONMENT)('type') ||
        this.getDefaultValue('instance_size');
      const instance = this.instanceTypes.find(t => t.name === instanceType);
      const toggleDoNotMountStorages = (e) => {
        if (e.target.checked) {
          this.props.form.setFieldsValue({
            [`${ADVANCED}.limitMounts`]: 'None'
          });
        } else {
          this.props.form.setFieldsValue({
            [`${ADVANCED}.limitMounts`]: null
          });
        }
      };
      return (
        <FormItem
          className={getFormItemClassName(styles.formItemRow, 'limitMounts')}
          {...this.cmdTemplateFormItemLayout}
          label="Limit mounts">
          <div>
            <Row type="flex" align="middle">
              <Checkbox
                checked={/^none$/i.test(currentValue)}
                onChange={toggleDoNotMountStorages}
              >
                Do not mount storages
              </Checkbox>
              <div style={{marginLeft: 7, marginTop: 3}}>
                {hints.renderHint(
                  this.localizedStringWithSpotDictionaryFn,
                  hints.doNotMountStoragesHint
                )}
              </div>
            </Row>
            <Row
              type="flex"
              align="middle"
              style={{display: noStoragesSelected ? 'none' : undefined}}
            >
              <div style={{flex: 1}}>
                <FormItem
                  className={styles.formItemRow}
                >
                  {this.getSectionFieldDecorator(ADVANCED)('limitMounts',
                    {
                      initialValue: defaultValue
                    }
                  )(
                    <LimitMountsInput
                      allowSensitive={this.toolAllowSensitive}
                      disabled={
                        !!this.state.fireCloudMethodName ||
                        (this.props.readOnly && !this.props.canExecute)
                      }
                    />
                  )}
                </FormItem>
              </div>
              <div style={{marginLeft: 7, marginTop: 3}}>
                {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.limitMountsHint)}
              </div>
            </Row>
            {
              !this.toolAllowSensitive && !noStoragesSelected && (
                <Alert
                  type="warning"
                  showIcon
                  message="Tool configuration restricts selection of sensitive storages"
                />
              )
            }
            {
              !this.props.editConfigurationMode && !noStoragesSelected && (
                <OOMCheck
                  dataStorages={
                    dataStorageAvailable.loaded
                      ? (dataStorageAvailable.value || [])
                      : []
                  }
                  limitMounts={currentValue}
                  preferences={this.props.preferences}
                  instance={instance}
                  platform={this.toolPlatform}
                />
              )
            }
          </div>
        </FormItem>
      );
    }
    return null;
  };

  renderHostedAppConfigurationItem = () => {
    if (
      this.props.detached ||
      this.props.isDetachedConfiguration ||
      this.props.editConfigurationMode
    ) {
      return null;
    }
    return (
      <FormItem
        className={getFormItemClassName(styles.formItemRow, 'hostedApplication')}
        {...this.leftFormItemLayout}
        label="Internal DNS name"
      >
        <Col span={10}>
          <FormItem
            className={styles.formItemRow}
          >
            {
              this.getSectionFieldDecorator(ADVANCED)('hostedApplication')(
                <HostedAppConfiguration />
              )
            }
          </FormItem>
        </Col>
        <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
          {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.hostedApplicationHint)}
        </Col>
      </FormItem>
    );
  };

  renderJobNotificationsItem = () => {
    if (
      this.props.detached ||
      this.props.isDetachedConfiguration ||
      this.props.editConfigurationMode
    ) {
      return null;
    }
    return (
      <FormItem
        className={getFormItemClassName(styles.formItemRow, 'notifications')}
        {...this.leftFormItemLayout}
        label="Notifications"
      >
        <Col span={10}>
          <FormItem
            className={styles.formItemRow}
          >
            <JobNotifications
              notifications={this.state.notifications}
              onChange={notifications => this.setState({
                notifications: (notifications || []).slice()
              })}
            />
          </FormItem>
        </Col>
        <Col span={1} style={{marginLeft: 7, marginTop: 3}}>
          {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.jobNotificationsHint)}
        </Col>
      </FormItem>
    );
  };

  renderCmdTemplateFormItem = () => {
    return (
      <FormItem
        className={getFormItemClassName(styles.formItemRow, 'cmdTemplate')}
        {...this.cmdTemplateFormItemLayout}
        label="Cmd template">
        <Row>
          <Row>
            <Checkbox
              disabled={
                !!this.state.fireCloudMethodName ||
                (this.props.readOnly && !this.props.canExecute) ||
                (this.state.pipeline && this.props.detached)
              }
              onChange={(e) => this.setState(
                {
                  startIdle: e.target.checked,
                  useDefaultCmd: false
                },
                this.formFieldsChanged
              )}
              checked={this.state.startIdle}>
              Start idle
            </Checkbox>
            {hints.renderHint(this.localizedStringWithSpotDictionaryFn, hints.startIdleHint)}
          </Row>
          {
            !!this.toolDefaultCmd && (
              <Row>
                <Checkbox
                  disabled={
                    !!this.state.fireCloudMethodName ||
                    (this.props.readOnly && !this.props.canExecute) ||
                    (this.state.pipeline && this.props.detached)
                  }
                  onChange={(e) => this.setState(
                    {
                      useDefaultCmd: e.target.checked,
                      startIdle: false
                    },
                    this.formFieldsChanged
                  )}
                  checked={this.state.useDefaultCmd}>
                  Use default command
                </Checkbox>
                {hints.renderHint(
                  this.localizedStringWithSpotDictionaryFn,
                  hints.useDefaultCommandHint
                )}
              </Row>
            )
          }
          {
            !this.state.startIdle && !this.state.useDefaultCmd
              ? (
                <Row>
                  <Col span={24}>
                    <FormItem
                      className={styles.formItemRow}
                      required={!this.state.fireCloudMethodName}>
                      {this.getSectionFieldDecorator(ADVANCED)('cmdTemplate',
                        {
                          rules: [{
                            required: !this.state.fireCloudMethodName,
                            message: 'Command template is required'
                          }],
                          initialValue: this.getDefaultValue('cmd_template')
                        }
                      )(
                        <Input
                          disabled={
                            (this.props.readOnly && !this.props.canExecute) ||
                            (this.state.pipeline && this.props.detached)
                          }
                          className={styles.hiddenItem} />
                      )}
                      <CodeEditor
                        ref={(editor) => { this.codeEditor = editor; }}
                        readOnly={
                          !!this.state.fireCloudMethodName ||
                          (this.props.readOnly && !this.props.canExecute) ||
                          (this.state.pipeline && this.props.detached)
                        }
                        className={styles.codeEditor}
                        language="shell"
                        onChange={this.cmdTemplateEditorValueChanged}
                        lineWrapping
                        defaultCode={this.getDefaultValue('cmd_template')}
                      />
                    </FormItem>
                  </Col>
                </Row>
              ) : undefined
          }
          {
            this.state.useDefaultCmd && this.toolDefaultCmd
              ? (
                <Row>
                  <Col span={24} className={styles.formItemRow}>
                    <CodeEditor
                      readOnly
                      className={styles.codeEditor}
                      language="shell"
                      lineWrapping
                      defaultCode={this.toolDefaultCmd}
                    />
                  </Col>
                </Row>
              ) : undefined
          }
        </Row>
      </FormItem>
    );
  };

  reset (keepPipeline) {
    const {resetFields} = this.props.form;
    resetFields();
    this.addedParameters = {};
    this.rebuildParameters = {
      [PARAMETERS]: true,
      [SYSTEM_PARAMETERS]: true
    };
    if (this.codeEditor) {
      this.codeEditor.reset();
      this.cmdTemplateValue = undefined;
    }
    this.resetState(keepPipeline);
  };

  toggleResolvedParameters = () => {
    const {parameters, form} = this.props;
    this.setState(prevState => ({
      useResolvedParameters: !prevState.useResolvedParameters
    }), () => {
      const {useResolvedParameters} = this.state;
      const formItems = form.getFieldValue(PARAMETERS);
      formItems.keys.forEach((key) => {
        const formItem = formItems.params[key];
        const parameter = parameters.parameters[formItem.name];
        if (
          parameter &&
          parameter.value !== parameter.resolvedValue &&
          parameter.resolvedValue !== undefined
        ) {
          formItem.value = useResolvedParameters
            ? parameter.resolvedValue
            : parameter.value;
          form.setFieldsValue({
            [PARAMETERS]: formItems
          });
        }
      });
    });
  };

  runNameAliasChange = (name) => {
    this.setState({runNameAlias: name});
  };

  renderRunButton = () => {
    if (!this.props.detached || !this.props.canExecute) {
      return undefined;
    }

    if (this.props.canRunCluster) {
      const onDropDownSelect = ({key}) => {
        if (
          this.state.currentProjectId &&
          this.state.rootEntityId &&
          this.validateFireCloudConnections()
        ) {
          this.openMetadataBrowser();
          this.setState({currentLaunchKey: key});
        } else {
          this.run({key});
        }
      };
      const dropDownMenu = (
        <Menu onClick={onDropDownSelect} selectedKeys={[]} style={{cursor: 'pointer'}}>
          <MenuItem key={RUN_SELECTED_KEY}>Run selected</MenuItem>
          <MenuItem key={RUN_CLUSTER_KEY}>Run cluster</MenuItem>
        </Menu>
      );
      return (
        <Dropdown
          overlay={dropDownMenu}
          placement="bottomRight"
          trigger={['click']}>
          <SubmitButton
            size="small"
            id="run-configuration-button" type="primary" style={{marginRight: 10}}
            inputs={this.inputPaths}
            outputs={this.outputPaths}
            skipCheck={
              this.props.parameters.run_as &&
              this.currentUserName() !== this.props.parameters.run_as
            }
            dockerImage={this.dockerImage}>
            Run <Icon type="down" />
          </SubmitButton>
        </Dropdown>
      );
    } else {
      return (
        <SubmitButton
          size="small"
          id="run-configuration-button"
          type="primary"
          inputs={this.inputPaths}
          outputs={this.outputPaths}
          skipCheck={
            this.props.parameters.run_as &&
            this.currentUserName() !== this.props.parameters.run_as
          }
          dockerImage={this.dockerImage}
          onClick={() => {
            if (this.validateFireCloudConnections()) {
              if (this.state.currentProjectId && this.state.rootEntityId) {
                this.openMetadataBrowser();
                this.setState({currentLaunchKey: RUN_SELECTED_KEY});
              } else {
                this.run({key: RUN_SELECTED_KEY});
              }
            }
          }}
          style={{marginRight: 10}}>
          Run
        </SubmitButton>
      );
    }
  };

  getDefaultOpenedPanels = () => {
    const cmdTemplate = this.getDefaultValue('cmd_template');
    const instanceType = this.getDefaultValue('instance_size');
    const disk = this.getDefaultValue('instance_disk');
    const dockerImage = this.getDefaultValue('docker_image');
    const panels = this.state.openedPanels || [];
    if (!cmdTemplate || !cmdTemplate.length) {
      if (panels.indexOf(ADVANCED) === -1) {
        panels.push(ADVANCED);
      }
    }
    if (!instanceType || !disk || !dockerImage) {
      if (panels.indexOf(EXEC_ENVIRONMENT) === -1) {
        panels.push(EXEC_ENVIRONMENT);
      }
    }
    return panels;
  };

  getPanelHeader = (key) => {
    let title;
    let icon;
    switch (key) {
      case EXEC_ENVIRONMENT: title = 'Exec environment'; icon = 'code-o'; break;
      case ADVANCED: title = 'Advanced'; icon = 'setting'; break;
      case PARAMETERS: title = 'Parameters'; icon = 'bars'; break;
    }
    return (
      <Row className={styles.panelHeader} type="flex" justify="space-between" align="middle">
        <span className={styles.itemHeader}>
          <Icon type={icon} /> {title}
        </span>
        {
          this.getPanelShortDescription(key)
        }
      </Row>
    );
  };

  getPanelShortDescription = (key) => {
    if (this.state.openedPanels.indexOf(key) >= 0) {
      return undefined;
    }
    const descriptions = [];
    switch (key) {
      case EXEC_ENVIRONMENT:
        const getDockerImageName = (dockerImage) => {
          if (!dockerImage) {
            return undefined;
          }
          const parts = dockerImage.split('/');
          if (parts.length > 2) {
            return parts.slice(1).join('/');
          } else {
            return dockerImage;
          }
        };
        descriptions.push(
          getDockerImageName(
            this.getSectionFieldValue(EXEC_ENVIRONMENT)('dockerImage') ||
            this.getDefaultValue('docker_image')
          )
        );
        if (this.state.launchCluster) {
          const instanceType = this.getSectionFieldValue(EXEC_ENVIRONMENT)('type') ||
            this.getDefaultValue('instance_size');
          descriptions.push(
            `${instanceType} ${ConfigureClusterDialog.getClusterDescription(this, true)}`
          );
        } else {
          descriptions.push(this.getSectionFieldValue(EXEC_ENVIRONMENT)('type') ||
            this.getDefaultValue('instance_size'));
        }
        descriptions.push(`${this.getSectionFieldValue(EXEC_ENVIRONMENT)('disk') ||
        this.getDefaultValue('instance_disk')}Gb`);
        break;
      case ADVANCED:
        const isSpot = `${this.getSectionFieldValue(ADVANCED)('is_spot') ||
          this.getDefaultValue('is_spot')}` === 'true';
        descriptions.push(getSpotTypeName(isSpot, this.currentCloudRegionProvider));
        const timeout = this.getSectionFieldValue(ADVANCED)('timeout') ||
          this.getDefaultValue('timeout');
        if (timeout && !isNaN(timeout)) {
          descriptions.push(`Timeout: ${timeout} min`);
        }
        if (this.state.startIdle) {
          descriptions.push('Start idle');
        } else {
          let command = this.getSectionFieldValue(ADVANCED)('cmdTemplate') ||
            this.getDefaultValue('cmd_template');
          if (command) {
            if (command.length > 50) {
              command = `${command.substring(0, 50)}...`;
            }
            descriptions.push(`"${command}"`);
          }
        }
        break;
    }
    return (
      <Row
        className={styles.panelDescriptionContainer}
        type="flex">
        {
          descriptions.filter(d => d && d.length).map((description, index) =>
            <span
              key={`description-${index}`}
              className={classNames(styles.panelDescription, 'cp-text-not-important')}>
              {description}
            </span>
          )
        }
      </Row>
    );
  };

  renderSeparator = (text, marginInCols, key, style) => {
    return (
      <Row key={key} type="flex" style={style || {margin: 0}}>
        <Col span={marginInCols} />
        <Col span={24 - 2 * marginInCols}>
          <table style={{width: '100%'}}>
            <tbody>
              <tr>
                <td style={{width: '50%'}}>
                  <div
                    className="cp-divider horizontal"
                    style={{
                      width: 'unset',
                      margin: '0 5px'
                    }}
                  >
                    {'\u00A0'}
                  </div>
                </td>
                <td style={{width: 1, whiteSpace: 'nowrap'}}><b>{text}</b></td>
                <td style={{width: '50%'}}>
                  <div
                    className="cp-divider horizontal"
                    style={{
                      width: 'unset',
                      margin: '0 5px'
                    }}
                  >
                    {'\u00A0'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </Col>
        <Col span={marginInCols} />
      </Row>
    );
  };

  renderFireCloudConfigConnectionsList = () => {
    if (this._fireCloudParameters && this._fireCloudParameters.pending) {
      return <Row style={{marginTop: 20}}><LoadingView /></Row>;
    }
    if (this._fireCloudParameters && this._fireCloudParameters.error) {
      return (
        <Row style={{marginTop: 20}}>
          <Alert type="warning" message={this._fireCloudParameters.error} />
        </Row>
      );
    }
    if (this._fireCloudParameters && this._fireCloudParameters.googleApi.error) {
      return (
        <Row style={{marginTop: 20}}>
          <Alert type="warning" message="Google auth initialization error" />
        </Row>
      );
    }
    if (this._fireCloudParameters && !this._fireCloudParameters.isSignedIn) {
      return (
        <Row
          type="flex"
          align="middle"
          justify="center"
          className={classNames(styles.fireCloudSignInContainer, 'cp-content-panel')}
        >
          <Row style={{margin: 2}}>
            You must sign in with your Google account to browse FireCloud method inputs & outputs
          </Row>
          <Row style={{margin: 2}}>
            <Button type="primary" onClick={this.props.googleApi.signIn}>
              Sign In
            </Button>
          </Row>
        </Row>
      );
    }
    if (!this.selectedFireCloudParameters) {
      return null;
    }
    const inputs = (this.selectedFireCloudParameters.inputs || []).map(i => i);
    const outputs = (this.selectedFireCloudParameters.outputs || []).map(o => o);
    const defaultInputs = this.getFireCloudDefaultInputs();
    const defaultOutputs = this.getFireCloudDefaultOutputs();
    const renderConnections = (connections, defaultConnections, key, stateKey, errorsStateKey) => {
      let conns = [];
      for (let i = 0; i < connections.length; i++) {
        const conn = connections[i];
        const onChange = (e) => {
          const values = this.state[stateKey];
          values[conn.name] = e.target.value;
          this.setState({[stateKey]: values}, this.formFieldsChanged);
        };
        let value = defaultConnections[conn.name];
        if (this.state[stateKey][conn.name] !== undefined) {
          value = this.state[stateKey][conn.name];
        }
        const error = this.state[errorsStateKey][conn.name];
        conns.push(
          <Row
            key={conn.name}
            align="middle"
            type="flex"
            style={{margin: '4px 0'}}>
            {
              <Popover
                content={
                  error
                    ? (
                      <div>
                        <Row>
                          {conn.name}
                        </Row>
                        <Row className="cp-error">
                          {error}
                        </Row>
                      </div>
                    )
                    : conn.name
                }
                trigger="hover">
                <Col
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  span={4}
                  offset={2}>
                  <span
                    className={
                      classNames(
                        {
                          'cp-error': error
                        }
                      )
                    }
                  >
                    {conn.name}
                  </span>
                </Col>
              </Popover>
            }
            <Col
              key={conn}
              span={15}>
              <Input
                value={value}
                onChange={onChange}
                size="large"
                className={
                  classNames({
                    'cp-error': error
                  })
                }
              />
            </Col>
          </Row>
        );
      }
      return <Row key={key}>
        <Col>
          {conns}
        </Col>
      </Row>;
    };
    return [
      inputs && this.renderSeparator(
        'FireCloud inputs',
        0,
        'FireCloud-inputs-separator',
        {marginTop: 20, marginBottom: 10}
      ),
      inputs && renderConnections(
        inputs,
        defaultInputs,
        'FireCloud-inputs-value',
        'fireCloudInputs',
        'fireCloudInputsErrors'
      ),
      outputs && this.renderSeparator(
        'FireCloud outputs',
        0,
        'FireCloud-outputs-separator',
        {marginTop: 20, marginBottom: 10}
      ),
      outputs && renderConnections(
        outputs,
        defaultOutputs,
        'FireCloud-outputs-value',
        'fireCloudOutputs',
        'fireCloudOutputsErrors'
      )
    ];
  };

  renderFormItemRow = (renderer, hint, options) => {
    const content = renderer && renderer(options);
    if (content) {
      return (
        <Row
          type="flex"
          className={styles.formItemContainer}
          style={options ? options.containerStyle : undefined}>
          {content}
          <div className={styles.hintContainer}>
            {hint ? hints.renderHint(this.localizedStringWithSpotDictionaryFn, hint) : '\u00A0'}
          </div>
        </Row>
      );
    }
    return null;
  };

  renderAlerts = () => {
    const {alerts} = this.props;
    if (!alerts || !alerts.length) {
      return null;
    }
    const defaultType = 'warning';
    const groupedAlerts = alerts.reduce((result, alert) => {
      const {type = defaultType} = alert;
      (result[type] = result[type] || []).push(alert);
      return result;
    }, {});
    const getMessagesList = (messages) => {
      return (
        <ul style={{listStyle: 'none'}}>
          {messages.map((alert, index) => (
            <li key={`error_${index}`}>{alert.message}</li>
          ))}
        </ul>
      );
    };
    return (
      <Row style={{marginBottom: '10px'}}>
        {Object.entries(groupedAlerts).map(([type, messages]) => {
          return messages && messages.length ? (
            <Alert
              key={type}
              type={type}
              style={{marginBottom: '4px'}}
              message={getMessagesList(messages)}
            />) : null;
        })}
      </Row>
    );
  };

  render () {
    const renderSubmitButton = () => {
      if (this.props.editConfigurationMode) {
        return (
          <td style={{textAlign: 'right'}} className={styles.actions}>
            <FormItem style={{margin: 0}}>
              {
                this.renderRunButton()
              }
              {
                this.props.detached && this.props.editConfigurationMode && (
                  <ServerlessAPIButton
                    style={{verticalAlign: 'middle', marginRight: 10}}
                    configurationId={this.props.configurationId}
                    configurationName={this.props.currentConfigurationName}
                  />
                )
              }
              {
                this.props.canRemove && !this.props.readOnly
                  ? (
                    <Button
                      size="small"
                      id="remove-pipeline-configuration-button"
                      type="danger"
                      onClick={
                        () => this.props.onRemoveConfiguration && this.props.onRemoveConfiguration()
                      }
                      style={{verticalAlign: 'middle'}}
                    >
                      Remove
                    </Button>
                  ) : undefined
              }
              {
                !this.props.currentConfigurationIsDefault && !this.props.readOnly
                  ? (
                    <Button
                      size="small"
                      id="set-pipeline-configuration-as-default-button"
                      onClick={
                        () => this.props.onSetConfigurationAsDefault &&
                          this.props.onSetConfigurationAsDefault()
                      }
                      style={{verticalAlign: 'middle', marginLeft: 10}}>
                      Set as default
                    </Button>
                  ) : undefined
              }
              {
                !this.props.readOnly
                  ? (
                    <Button
                      size="small"
                      id="save-pipeline-configuration-button"
                      disabled={!this.modified}
                      type="primary"
                      htmlType="submit"
                      style={{verticalAlign: 'middle', marginLeft: 10}}>
                      Save
                    </Button>
                  ) : undefined
              }
            </FormItem>
          </td>
        );
      } else if (!this.props.pipeline || roleModel.executeAllowed(this.props.pipeline)) {
        const KEYS = {
          selectMetadata: 'select metadata'
        };
        const onDropDownClick = ({key}) => {
          if (key === KEYS.selectMetadata) {
            this.run({key: RUN_SELECTED_KEY});
          }
        };
        const dropdownRenderer = () => (
          <Menu onClick={onDropDownClick} selectedKeys={[]} style={{cursor: 'pointer'}}>
            <MenuItem key={KEYS.selectMetadata}>
              Select metadata entries and launch
            </MenuItem>
          </Menu>
        );
        return (
          <td style={{textAlign: 'right'}}>
            <FormItem style={{margin: 0, marginRight: 10}}>
              {
                !this.props.detached && !this.props.editConfigurationMode && (
                  <Button
                    id="launch-command-button"
                    disabled={!this.launchCommandPayload}
                    style={{marginRight: 5}}
                    onClick={this.showLaunchCommands}
                  >
                    <Icon type="code" />
                  </Button>
                )
              }
              <SubmitButton
                id="launch-pipeline-button"
                inputs={this.inputPaths}
                outputs={this.outputPaths}
                skipCheck={
                  this.props.parameters.run_as &&
                  this.currentUserName() !== this.props.parameters.run_as
                }
                dockerImage={this.dockerImage}
                type="primary"
                htmlType="submit"
                dropdown={!!this.props.runConfigurationId}
                dropdownRenderer={dropdownRenderer}
                dropdownId="launch-metadata"
              >
                Launch
              </SubmitButton>
            </FormItem>
          </td>
        );
      }
      return undefined;
    };
    const renderFormTitle = () => {
      if (this.props.editConfigurationMode) {
        const nameError =
          'Name can contain only letters, digits, spaces, \'_\', \'-\', \'@\' and \'.\'.';
        return [
          <td key="name" style={{width: 40, whiteSpace: 'nowrap'}}>
            Name:
          </td>,
          <td key="input" style={{width: '30%'}}>
            <FormItem
              className={styles.formItemRow}
              hasFeedback>
              {this.getSectionFieldDecorator('configuration')('name',
                {
                  rules: [
                    {
                      required: true,
                      message: 'Configuration name is required'
                    },
                    {
                      pattern: /^[\da-zA-Z._\-@ ]+$/,
                      message: nameError
                    }
                  ],
                  initialValue: this.props.currentConfigurationName
                }
              )(
                <Input disabled={this.props.readOnly && !this.props.canExecute} />
              )}
            </FormItem>
          </td>,
          <td key="estimated price">
            {this.renderEstimatedPriceInfo()}
          </td>
        ];
      } else {
        let configuration = [];
        if (this.props.configurations.length > 0 && this.props.currentConfigurationName) {
          const configurationChange = (configurationName) => {
            if (this.props.onConfigurationChanged) {
              this.props.onConfigurationChanged(configurationName);
            }
          };
          configuration = [
            <td
              style={{
                width: 1,
                whiteSpace: 'nowrap',
                paddingLeft: '3px'
              }}
              key="configuration title"
              className={styles.itemHeader}>configuration: </td>,
            <td key="configuration selector" style={{width: 200, paddingLeft: 5}}>
              <Select
                disabled={this.props.readOnly && !this.props.canExecute}
                defaultValue={this.props.currentConfigurationName}
                showSearch
                allowClear={false}
                placeholder="Configuration name"
                optionFilterProp="children"
                onChange={configurationChange}
                filterOption={
                  (input, option) =>
                    option.props.value.toLowerCase().indexOf(input.toLowerCase()) >= 0} >
                {
                  this.props.configurations.map(c => {
                    return (
                      <Select.Option
                        key={c.name}
                        value={c.name}>
                        {c.name}
                      </Select.Option>
                    );
                  })
                }
              </Select>
            </td>
          ];
        }

        let pipelineName, pipelineVersion;
        if (this.props.pipeline) {
          pipelineName = this.props.pipeline.name;
          if (this.props.version) {
            pipelineVersion = this.props.version;
          }
        } else {
          const dockerImageParts = (
            this.props.form.getFieldValue(`${EXEC_ENVIRONMENT}.dockerImage`) || ''
          ).split('/');
          if (dockerImageParts.length > 0) {
            pipelineName = dockerImageParts[dockerImageParts.length - 1].split(':')[0];
            pipelineVersion = dockerImageParts[dockerImageParts.length - 1].split(':')[1];
          } else {
            pipelineName = this.localizedString('pipeline');
          }
        }

        return [
          <td key="header" className={styles.itemHeader} style={{width: 1, whiteSpace: 'nowrap'}}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                alignItems: 'baseline',
                lineHeight: '32px'
              }}
            >
              <Icon
                type="play-circle-o"
                className="cp-primary"
              />
              <span style={{whiteSpace: 'pre'}}>Launch </span>
              <RunName
                style={{fontWeight: 'bold'}}
                alias={this.state.runNameAlias}
                editable
                onChange={this.runNameAliasChange}
                ignoreOffset
              >
                <span
                  id="launch-form-pipeline-name"
                >
                  {pipelineName}
                </span>
                {
                  pipelineVersion && (
                    <span
                      id="launch-form-pipeline-version"
                      style={{fontWeight: 'normal'}}
                    >
                      :{pipelineVersion}
                    </span>
                  )
                }
              </RunName>
              <span>.</span>
            </div>
          </td>,
          ...configuration,
          <td
            key="estimated price"
            className={styles.itemHeader}
            style={{width: 1, whiteSpace: 'nowrap'}}>
            {this.renderEstimatedPriceInfo()}
          </td>
        ];
      }
    };
    return (
      <Form onSubmit={this.handleSubmit}>
        <div className={styles.layout}>
          <table
            style={{width: '100%'}}
            className={classNames(styles.layoutHeader, 'cp-divider', 'bottom')}
          >
            <tbody>
              <tr>
                {renderFormTitle()}
                {renderSubmitButton()}
              </tr>
            </tbody>
          </table>
          {this.renderAlerts()}
          {
            this.props.pipeline &&
            !roleModel.executeAllowed(this.props.pipeline) &&
            !this.props.detached
              ? (
                <Row>
                  <Alert
                    type="warning"
                    message={`You have no permissions to launch ${this.props.pipeline.name}`} />
                  <br />
                </Row>
              ) : undefined
          }
          <Collapse
            bordered={false}
            onChange={(tabs) => this.setState({openedPanels: tabs})}
            activeKey={this.state.openedPanels}>
            <Collapse.Panel
              id="launch-pipeline-exec-environment-panel"
              key={EXEC_ENVIRONMENT}
              className={styles.section}
              header={this.getPanelHeader(EXEC_ENVIRONMENT)}>
              <Row type="flex" justify="space-between">
                <div
                  className={styles.settingsContainer}
                  style={{padding: 5}}>
                  <div className={styles.settingsContent}>
                    {this.renderFormItemRow(this.renderPipelineSelection, hints.pipelineHint)}
                    {this.renderFormItemRow(this.renderExecutionEnvironmentSelection)}
                    {this.renderFormItemRow(this.renderDockerImageFormItem, hints.dockerImageHint)}
                    {
                      this.renderFormItemRow(
                        this.renderInstanceTypeSelection,
                        hints.instanceTypeHint
                      )
                    }
                    {this.renderFormItemRow(this.renderDiskFormItem, hints.diskHint)}
                    {!this.isWindowsPlatform &&
                    !this.state.fireCloudMethodName &&
                    !this.state.isDts && (
                      <Row
                        type="flex"
                        className={styles.formItemContainer}
                        style={{flexWrap: 'wrap', marginRight: '5px'}}
                      >
                        <Col
                          offset={6}
                          span={17}
                        >
                          <AllowedInstancesCountWarning
                            payload={{
                              nodeCount: this.state.nodesCount,
                              maxNodeCount: this.state.maxNodesCount
                            }}
                            style={{width: '100%'}}
                          />
                        </Col>
                        <a
                          onClick={this.openConfigureClusterDialog}
                          className="cp-text underline"
                          style={{marginLeft: 'auto', marginRight: '30px'}}
                        >
                          <Icon type="setting" />
                          {ConfigureClusterDialog.getConfigureClusterButtonDescription(this)}
                        </a>
                      </Row>
                    )}
                    <ConfigureClusterDialog
                      instanceName={this.getSectionFieldValue(EXEC_ENVIRONMENT)('type')}
                      launchCluster={this.state.launchCluster}
                      cloudRegionProvider={this.currentCloudRegionProvider}
                      autoScaledPriceType={this.state.autoScaledPriceType}
                      autoScaledCluster={this.state.autoScaledCluster}
                      hybridAutoScaledClusterEnabled={this.state.hybridAutoScaledClusterEnabled}
                      gpuScalingConfiguration={this.state.gpuScalingConfiguration}
                      gridEngineEnabled={this.state.gridEngineEnabled}
                      sparkEnabled={this.state.sparkEnabled}
                      slurmEnabled={this.state.slurmEnabled}
                      kubeEnabled={this.state.kubeEnabled}
                      nodesCount={this.state.nodesCount}
                      maxNodesCount={this.state.maxNodesCount || 1}
                      onClose={this.closeConfigureClusterDialog}
                      onChange={this.onChangeClusterConfiguration}
                      visible={this.state.configureClusterDialogVisible}
                      disabled={this.props.readOnly && !this.props.canExecute}
                      instanceTypes={this.instanceTypes}
                    />
                    {
                      this.renderFormItemRow(
                        this.renderAWSRegionSelection,
                        this.regionDisabledByToolSettings
                          ? hints.awsRegionRestrictedByToolSettingsHint
                          : hints.awsRegionHint
                      )
                    }
                    {this.renderFormItemRow(this.renderCoresFormItem)}
                    {
                      this.renderFormItemRow(
                        this.renderAdditionalRunCapabilities,
                        hints.runCapabilitiesHint
                      )
                    }
                  </div>
                </div>
                <div
                  className={styles.settingsContainer}
                  style={{padding: 5}}>
                  <div className={styles.settingsContent}>
                    <Row
                      type="flex"
                      style={{alignItems: 'center'}}
                    >
                      {
                        this.renderExecutionEnvironmentSummary()
                      }
                    </Row>
                  </div>
                </div>
              </Row>
            </Collapse.Panel>
            <Collapse.Panel
              id="launch-pipeline-advanced-panel"
              key={ADVANCED}
              className={styles.section}
              header={this.getPanelHeader(ADVANCED)}>
              {this.renderScheduleControl()}
              {this.renderPriceTypeSelection()}
              {this.renderDisableAutoPauseFormItem()}
              {this.renderPrettyUrlFormItem()}
              {this.renderHostedAppConfigurationItem()}
              {this.renderJobNotificationsItem()}
              {this.renderTimeoutFormItem()}
              {this.renderEndpointNameFormItem()}
              {this.renderStopAfterFormItem()}
              {this.renderLimitMountsFormItem()}
              {this.renderCmdTemplateFormItem()}
              {this.renderParameters(true)}
            </Collapse.Panel>
            <Collapse.Panel
              id="launch-pipeline-parameters-panel"
              key={PARAMETERS}
              className={styles.section}
              header={this.getPanelHeader(PARAMETERS)}
            >
              {this.renderParameters(false)}
              {this.isFireCloudSelected && this.renderFireCloudConfigConnectionsList()}
            </Collapse.Panel>
            {
              !this.state.detached && !this.props.editConfigurationMode && (
                <LaunchCommand
                  payload={this.launchCommandPayload}
                  visible={this.state.showLaunchCommands}
                  onClose={this.hideLaunchCommands}
                />
              )
            }
          </Collapse>
        </div>
        <BucketBrowser
          multiple
          onSelect={this.selectButcketPath}
          onCancel={this.closeBucketBrowser}
          visible={this.state.bucketBrowserVisible}
          path={this.state.bucketPath}
          showOnlyFolder={this.state.showOnlyFolderInBucketBrowser}
          checkWritePermissions={this.state.showOnlyFolderInBucketBrowser}
          bucketTypes={['AZ', 'S3', 'GS', 'DTS', 'NFS']} />
        <PipelineBrowser
          multiple={false}
          onCancel={this.closePipelineBrowser}
          onSelect={this.selectPipelineConfirm}
          visible={this.state.pipelineBrowserVisible}
          pipelineId={this.state.pipeline ? this.state.pipeline.id : undefined}
          version={this.state.version}
          pipelineConfiguration={this.state.pipelineConfiguration}
          fireCloudMethod={this.state.fireCloudMethodName}
          fireCloudNamespace={this.state.fireCloudMethodNamespace}
          fireCloudMethodSnapshot={this.state.fireCloudMethodSnapshot}
          fireCloudMethodConfiguration={this.state.fireCloudMethodConfiguration}
          fireCloudMethodConfigurationSnapshot={this.state.fireCloudMethodConfigurationSnapshot}
        />
        {
          this.state.currentProjectId
            ? (
              <MetadataBrowser
                multiple={false}
                readOnly
                onCancel={this.closeMetadataBrowser}
                onSelect={this.selectMetadataConfirm}
                visible={this.state.metadataBrowserVisible}
                initialFolderId={this.state.currentProjectId}
                rootEntityId={this.state.rootEntityId}
                currentMetadataEntity={this.state.currentMetadataEntity.slice()}
              />
            ) : undefined
        }
      </Form>
    );
  }

  fireCloudSelectionChanged = (prevState) => {
    return (this.state.fireCloudMethodNamespace !== prevState.fireCloudMethodNamespace ||
      this.state.fireCloudMethodName !== prevState.fireCloudMethodName ||
      this.state.fireCloudMethodSnapshot !== prevState.fireCloudMethodSnapshot ||
      this.state.fireCloudMethodConfiguration !== prevState.fireCloudMethodConfiguration ||
      this.state.fireCloudMethodConfigurationSnapshot !==
        prevState.fireCloudMethodConfigurationSnapshot);
  };

  componentDidMount () {
    this.reset(true);
    this.evaluateEstimatedPrice({});
    if (this.props.parameters && this.props.parameters.docker_image) {
      this.loadToolSettings(this.props.parameters.docker_image);
    }
    this.prepare();
    if (this.props.isDetachedConfiguration) {
      this.loadCurrentProject();
      if (this.isFireCloudSelected) {
        this.loadFireCloudConfigurations();
      }
    }
    this.props.onInitialized && this.props.onInitialized(this);
  }

  componentDidUpdate (prevProps, prevState) {
    if (this.state.fireCloudMethodName &&
      this.state.execEnvSelectValue !== FIRE_CLOUD_ENVIRONMENT) {
      // eslint-disable-next-line
      this.setState({execEnvSelectValue: FIRE_CLOUD_ENVIRONMENT});
    }
    if (prevState.dtsId !== this.state.dtsId && this.state.dtsId) {
      this.loadDtsClusterInfo();
    }
    if (prevProps.currentConfigurationName !== this.props.currentConfigurationName ||
      prevProps.configurationId !== this.props.configurationId) {
      this.prevParameters = {};
      this.reset();
      this.evaluateEstimatedPrice({});
      this.prepare(true);
    }
    if (prevProps.defaultPriceTypeIsSpot !== this.props.defaultPriceTypeIsSpot) {
      this.evaluateEstimatedPrice({});
    }
    if (!pipelinesEquals(prevProps.pipeline, this.props.pipeline) ||
      prevProps.version !== this.props.version ||
      prevProps.pipelineConfiguration !== this.props.pipelineConfiguration) {
      this.evaluateEstimatedPrice({});
      this.prepare();
    }
    if (prevProps.isDetachedConfiguration &&
      (prevProps.configurationId !== this.props.configurationId ||
        prevProps.currentConfigurationName !== this.props.currentConfigurationName)) {
      this.loadCurrentProject();
    }
    if (this.props.isDetachedConfiguration && this.isFireCloudSelected &&
      this.fireCloudSelectionChanged(prevState)) {
      this.loadFireCloudConfigurations();
    } else if (this.props.isDetachedConfiguration && !this.isFireCloudSelected) {
      this._fireCloudConfigurations = null;
    }
    if (this.props.allowedInstanceTypes &&
      this.props.allowedInstanceTypes.loaded &&
      this.props.allowedInstanceTypes.changed) {
      this.correctAllowedInstanceValues();
      this.props.allowedInstanceTypes.handleChanged();
    }
    if ((prevProps.parameters || {}).docker_image !== (this.props.parameters || {}).docker_image) {
      if (this.props.parameters && this.props.parameters.docker_image) {
        this.loadToolSettings(this.props.parameters.docker_image);
      } else {
        this.resetToolSettings();
      }
    }
    if (prevProps.allowedInstanceTypes.loaded &&
      !this.state.estimatedPrice.evaluated &&
      !this.state.estimatedPrice.pending) {
      this.evaluateEstimatedPrice({});
    }
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.fireCloudMethod && nextProps.fireCloudMethod.name &&
      this.state.execEnvSelectValue !== FIRE_CLOUD_ENVIRONMENT) {
      this.setState({execEnvSelectValue: FIRE_CLOUD_ENVIRONMENT});
    }
    if (nextProps.detached &&
      (nextProps.currentConfigurationName !== this.props.currentConfigurationName ||
      nextProps.configurationId !== this.props.configurationId)) {
      let execEnvSelectValue;
      let isDts = false;
      let dtsId = null;
      const [currentConfiguration] = nextProps.configurations
        .filter(config => config.name === nextProps.currentConfigurationName);

      switch (currentConfiguration.executionEnvironment) {
        case DTS_ENVIRONMENT:
          dtsId = currentConfiguration.dtsId;
          isDts = true;
          execEnvSelectValue = `${DTS_ENVIRONMENT}.${dtsId}`;
          break;
        case FIRE_CLOUD_ENVIRONMENT:
          execEnvSelectValue = FIRE_CLOUD_ENVIRONMENT;
          break;
        default:
          execEnvSelectValue = CLOUD_PLATFORM_ENVIRONMENT;
      }

      this.setState({execEnvSelectValue, isDts, dtsId});
    }
    if (nextProps.isDetachedConfiguration &&
      !nextProps.selectedPipelineParametersIsLoading &&
      this.props.selectedPipelineParametersIsLoading !==
      nextProps.selectedPipelineParametersIsLoading
    ) {
      this.rebuildParameters = {
        [PARAMETERS]: true,
        [SYSTEM_PARAMETERS]: true
      };
    }
    if ((!this.props.fireCloudMethod && nextProps.fireCloudMethod) ||
      (nextProps.fireCloudMethod &&
        (this.props.fireCloudMethod.name !== nextProps.fireCloudMethod.name ||
        this.props.fireCloudMethod.namespace !== nextProps.fireCloudMethod.namespace ||
        this.props.fireCloudMethod.snapshot !== nextProps.fireCloudMethod.snapshot ||
        this.props.fireCloudMethod.configuration !== nextProps.fireCloudMethod.configuration ||
        this.props.fireCloudMethod.configurationSnapshot !==
          nextProps.fireCloudMethod.configurationSnapshot))) {
      this.setState({
        fireCloudMethodName: nextProps.fireCloudMethod.name,
        fireCloudMethodNamespace: nextProps.fireCloudMethod.namespace,
        fireCloudMethodSnapshot: nextProps.fireCloudMethod.snapshot,
        fireCloudMethodConfiguration: nextProps.fireCloudMethod.configuration,
        fireCloudMethodConfigurationSnapshot: nextProps.fireCloudMethod.configurationSnapshot,
        fireCloudInputs: {},
        fireCloudOutputs: {},
        fireCloudDefaultInputs: nextProps.fireCloudMethod.methodInputs,
        fireCloudDefaultOutputs: nextProps.fireCloudMethod.methodOutputs
      });
    } else if (this.props.fireCloudMethod && !nextProps.fireCloudMethod) {
      this.setState({
        fireCloudMethodName: null,
        fireCloudMethodNamespace: null,
        fireCloudMethodSnapshot: null,
        fireCloudMethodConfiguration: null,
        fireCloudMethodConfigurationSnapshot: null,
        fireCloudInputs: {},
        fireCloudOutputs: {},
        fireCloudDefaultInputs: [],
        fireCloudDefaultOutputs: []
      });
    }
  }
}

export default class extends React.Component {
  launchForm;

  onInitialized = (form) => {
    this.launchForm = form;
  };

  onValuesChange = (props, fields) => {
    const cloudRegionKey = `${EXEC_ENVIRONMENT}.cloudRegionId`;
    const spotKey = `${ADVANCED}.is_spot`;
    if (fields &&
      fields[cloudRegionKey] &&
      props.allowedInstanceTypes) {
      props.allowedInstanceTypes.setRegionId(+fields[cloudRegionKey]);
    } else if (fields &&
      fields.exec &&
      fields.exec.cloudRegionId &&
      props.allowedInstanceTypes) {
      props.allowedInstanceTypes.setRegionId(+fields.exec.cloudRegionId);
    }
    if (fields &&
      fields[spotKey] &&
      fields[spotKey] !== undefined &&
      fields[spotKey] !== null &&
      props.allowedInstanceTypes) {
      props.allowedInstanceTypes.setIsSpot(`${fields[spotKey]}` === 'true');
    } else if (fields &&
      fields[ADVANCED] &&
      fields[ADVANCED].is_spot !== undefined &&
      fields[ADVANCED].is_spot !== null &&
      props.allowedInstanceTypes) {
      props.allowedInstanceTypes.setIsSpot(`${fields[ADVANCED].is_spot}` === 'true');
    }
  };

  onFieldsChange = (props, fields) => {
    if (this.launchForm &&
      this.launchForm.formFieldsChanged &&
      Object.values(fields).filter(v => !v.dirty).length > 0) {
      this.launchForm.formFieldsChanged();
    }
  };

  launchPipelineForm = Form.create({
    onValuesChange: this.onValuesChange,
    onFieldsChange: this.onFieldsChange
  })(LaunchPipelineForm);

  render () {
    const LaunchForm = this.launchPipelineForm;
    const props = this.props;
    return (
      <LaunchForm {...props} onInitialized={this.onInitialized} />
    );
  }
}
