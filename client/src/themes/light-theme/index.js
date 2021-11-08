/*
 * Copyright 2017-2021 EPAM Systems, Inc. (https://www.epam.com/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/* eslint-disable max-len */

export default {
  identifier: 'light-theme',
  name: 'Light',
  extends: undefined,
  predefined: true,
  configuration: {
    '@application-background-color': '#ececec',
    '@application-color': 'rgba(0, 0, 0, 0.65)',
    '@application-color-faded': 'fadeout(@application-color, 20%)',
    '@application-color-disabled': 'fadeout(@application-color, 40%)',
    '@primary-color': '#108ee9',
    '@primary-text-color': 'white',
    '@color-green': 'green',
    '@color-red': '#c01911',
    '@color-yellow': '#ff8818',
    '@color-blue': '@primary-color',
    '@status-good-color': '@color-green',
    '@status-warning-color': '@color-yellow',
    '@status-bad-color': '@color-red',
    '@status-info-color': '@color-blue',
    '@input-background': '#fff',
    '@input-border': '#d9d9d9',
    '@input-color': 'rgba(0, 0, 0, 0.65)',
    '@input-placeholder-color': 'rgba(0, 0, 0, 0.3)',
    '@input-border-hover-color': '#49a9ee',
    '@input-shadow-color': 'rgba(16, 142, 233, 0.2)',
    '@input-search-icon-color': 'rgba(0, 0, 0, 0.65)',
    '@input-search-icon-hovered-color': '#49a9ee',
    '@panel-background-color': 'white',
    '@panel-border-color': '#ccc',
    '@panel-transparent-color': 'white',
    '@card-background-color': 'white',
    '@card-border-color': '#ddd',
    '@card-hovered-shadow-color': 'rgba(0, 0, 0, 0.2)',
    '@card-actions-active-background': 'rgb(225, 241, 252)',
    '@card-header-background': '#eee',
    '@card-service-background-color': '#ffffe0',
    '@card-service-border-color': '@card-border-color',
    '@card-service-hovered-shadow-color': '@card-hovered-shadow-color',
    '@card-service-actions-active-background': '@card-actions-active-background',
    '@card-service-header-background': '@card-header-background',
    '@navigation-panel-color': '#2796dd',
    '@navigation-panel-color-impersonated': '#dd5b27',
    '@navigation-panel-highlighted-color': 'darken(@navigation-panel-color, 10%)',
    '@navigation-panel-highlighted-color-impersonated': 'darken(@navigation-panel-color-impersonated, 10%)',
    '@navigation-item-color': 'white',
    '@navigation-item-runs-color': '#0cff87',
    '@tag-key-background-color': '#efefef',
    '@tag-key-value-divider-color': '#ddd',
    '@tag-value-background-color': '#fefefe',
    '@nfs-icon-color': '#116118',
    '@aws-icon': "@static_resource('icons/providers/aws.svg')",
    '@gcp-icon': "@static_resource('icons/providers/gcp.svg')",
    '@azure-icon': "@static_resource('icons/providers/azure.svg')",
    '@eu-region-icon': "@static_resource('icons/regions/eu.svg')",
    '@us-region-icon': "@static_resource('icons/regions/us.svg')",
    '@sa-region-icon': "@static_resource('icons/regions/sa.svg')",
    '@cn-region-icon': "@static_resource('icons/regions/cn.svg')",
    '@ca-region-icon': "@static_resource('icons/regions/ca.svg')",
    '@ap-northeast-1-region-icon': "@static_resource('icons/regions/ap-northeast-1.svg')",
    '@ap-northeast-2-region-icon': "@static_resource('icons/regions/ap-northeast-2.svg')",
    '@ap-northeast-3-region-icon': "@static_resource('icons/regions/ap-northeast-3.svg')",
    '@ap-south-1-region-icon': "@static_resource('icons/regions/ap-south-1.svg')",
    '@ap-southeast-1-region-icon': "@static_resource('icons/regions/ap-southeast-1.svg')",
    '@ap-southeast-2-region-icon': "@static_resource('icons/regions/ap-southeast-2.svg')",
    '@taiwan-region-icon': "@static_resource('icons/regions/taiwan.svg')",
    '@theme-transition-duration': '250ms',
    '@theme-transition-function': 'linear',
    '@modal-mask-background': 'rgba(55, 55, 55, 0.6)',
    '@even-element-background': 'rgba(0, 0, 0, 0.05)',
    '@alert-success-background': '#ebf8f2',
    '@alert-success-border': '#cfefdf',
    '@alert-success-icon': '#00a854',
    '@alert-warning-background': '#fffaeb',
    '@alert-warning-border': '#fff3cf',
    '@alert-warning-icon': '#ffbf00',
    '@alert-error-background': '#fef0ef',
    '@alert-error-border': '#fcdbd9',
    '@alert-error-icon': '#f04134',
    '@alert-info-background': '#ecf6fd',
    '@alert-info-border': '#d2eafb',
    '@alert-info-icon': '@primary-color',
    '@table-element-selected-background-color': '#d2eafb',
    '@table-element-selected-color': '@application-color',
    '@table-element-hover-background-color': '#ecf6fd',
    '@table-element-hover-color': '@application-color',
    '@menu-color': '@application-color',
    '@menu-active-color': '@primary-color',
    '@menu-border-color': '#e9e9e9'
  }
};
