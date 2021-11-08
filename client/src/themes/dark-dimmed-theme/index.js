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
  identifier: 'dark-dimmed-theme',
  name: 'Dark dimmed',
  extends: 'dark-theme',
  predefined: true,
  configuration: {
    '@application-background-color': 'rgb(40, 44, 50)',
    '@application-color': 'rgb(202, 202, 216)',
    '@application-color-faded': 'fadeout(@application-color, 20%)',
    '@application-color-disabled': 'fadeout(@application-color, 60%)',
    '@primary-color': '#108ee9',
    '@primary-text-color': 'white',
    '@color-green': '#118a4e',
    '@color-red': '#e13e0e',
    '@color-yellow': '#c28b15',
    '@color-blue': '#108ee9',
    '@status-good-color': '@color-green',
    '@status-warning-color': '@color-yellow',
    '@status-bad-color': '@color-red',
    '@status-info-color': '@color-blue',
    '@panel-background-color': 'rgb(44, 49, 55)',
    '@panel-border-color': 'rgb(28, 30, 33)',
    '@panel-transparent-color': 'transparent',
    '@input-background': '@panel-background-color',
    '@input-border': '@panel-border-color',
    '@input-color': '@application-color',
    '@input-placeholder-color': 'fade(@application-color, 20%)',
    '@input-border-hover-color': 'fade(@application-color, 20%)',
    '@input-shadow-color': 'rgba(202, 202, 216, 0.05)',
    '@input-search-icon-color': 'rgba(202, 202, 216, 0.3)',
    '@input-search-icon-hovered-color': 'rgba(202, 202, 216, 0.6)',
    '@card-background-color': 'lighten(@panel-background-color, 2%)',
    '@card-border-color': 'darken(@panel-background-color, 4%)',
    '@card-hovered-shadow-color': '@card-border-color',
    '@card-actions-active-background': '@card-background-color',
    '@card-header-background': '@card-border-color',
    '@card-service-background-color': 'lighten(@card-background-color, 5%)',
    '@card-service-border-color': '@card-service-background-color',
    '@card-service-hovered-shadow-color': 'transparent',
    '@card-service-actions-active-background': '@card-service-background-color',
    '@card-service-header-background': '@card-service-background-color',
    '@navigation-panel-color': '@application-background-color',
    '@navigation-panel-color-impersonated': '#914519',
    '@navigation-panel-highlighted-color': 'darken(@navigation-panel-color, 5%)',
    '@navigation-panel-highlighted-color-impersonated': 'darken(@navigation-panel-color-impersonated, 10%)',
    '@navigation-item-color': '@application-color',
    '@navigation-item-runs-color': '@color-green',
    '@tag-key-background-color': 'lighten(@card-background-color, 5%)',
    '@tag-key-value-divider-color': '@card-background-color',
    '@tag-value-background-color': 'lighten(@card-background-color, 5%)',
    '@nfs-icon-color': '@color-green',
    '@aws-icon': "@static_resource('icons/providers/aws-light.svg')",
    '@modal-mask-background': 'rgba(0, 0, 0, 0.6)',
    '@even-element-background': 'rgba(255, 255, 255, 0.1)',
    '@alert-success-background': 'darken(@status-good-color, 15%)',
    '@alert-success-border': '@status-good-color',
    '@alert-success-icon': '@status-good-color',
    '@alert-warning-background': 'darken(@status-warning-color, 15%)',
    '@alert-warning-border': '@status-warning-color',
    '@alert-warning-icon': '@status-warning-color',
    '@alert-error-background': 'darken(@status-bad-color, 15%)',
    '@alert-error-border': '@status-bad-color',
    '@alert-error-icon': '@status-bad-color',
    '@alert-info-background': 'darken(@status-info-color, 15%)',
    '@alert-info-border': '@status-info-color',
    '@alert-info-icon': '@status-info-color',
    '@table-element-selected-background-color': '@navigation-panel-highlighted-color',
    '@table-element-selected-color': '@application-color',
    '@table-element-hover-background-color': '@navigation-panel-highlighted-color',
    '@table-element-hover-color': '@application-color',
    '@menu-color': '@application-color',
    '@menu-active-color': '@application-color',
    '@menu-border-color': '@panel-border-color'
  }
};
