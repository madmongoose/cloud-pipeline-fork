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

import {observable, isObservableArray} from 'mobx';
import {Period, getPeriod} from '../../special/periods';
import RunnerType from './runner-types';
import ReportsRouting from './reports-routing';

class Filter {
  static RUNNER_SEPARATOR = '|';
  static REGION_SEPARATOR = '|';
  @observable period;
  @observable range;
  @observable report;
  @observable runner;

  rebuild = ({location, router}) => {
    this.router = router;
    const {
      period = Period.month,
      user,
      group,
      range,
      region
    } = (location || {}).query || {};
    if (user) {
      this.runner = {
        type: RunnerType.user,
        id: (user || '').split(Filter.RUNNER_SEPARATOR)
      };
    } else if (group) {
      this.runner = {
        type: RunnerType.group,
        id: (group || '').split(Filter.RUNNER_SEPARATOR)
      };
    } else {
      this.runner = undefined;
    }
    this.report = ReportsRouting.parse(location);
    this.period = period;
    this.range = range;
    this.region = (region || '').split(Filter.REGION_SEPARATOR).filter(Boolean);
  };

  navigate = (navigation, strictRange = false) => {
    let {report, runner, period, range, region} = navigation || {};
    if (report === undefined) {
      report = this.report;
    }
    if (runner === undefined) {
      runner = this.runner;
    }
    if (period === undefined) {
      period = this.period;
    }
    if (range === undefined && !strictRange) {
      range = this.range;
    }
    if (region === undefined) {
      region = this.region;
    }
    if (/^quotas/i.test(report)) {
      runner = undefined;
      range = undefined;
      period = undefined;
      region = undefined;
    }
    const regions = (region || []);
    const mapRunnerId = (id) => {
      if (id && (Array.isArray(id) || isObservableArray(id))) {
        return id.join(Filter.RUNNER_SEPARATOR);
      }
      return id;
    };
    const mapRegionId = (id) => {
      if (id && (Array.isArray(id) || isObservableArray(id))) {
        return id.join(Filter.REGION_SEPARATOR);
      }
      return id;
    };
    const params = [
      runner && runner.type === RunnerType.user && `user=${mapRunnerId(runner.id)}`,
      runner && runner.type === RunnerType.group && `group=${mapRunnerId(runner.id)}`,
      period && `period=${period}`,
      range && `range=${range}`,
      regions.length > 0 && `region=${mapRegionId(regions)}`
    ].filter(Boolean);
    let query = '';
    if (params.length) {
      query = `?${params.join('&')}`;
    }
    if (this.router) {
      this.router.push(`${ReportsRouting.getPath(report)}${query}`);
    }
  };

  getDescription = ({users, cloudRegionsInfo, discounts}) => {
    const {
      computeRaw = 0,
      storageRaw = 0
    } = discounts || {};
    let discountsTitle = '';
    if (computeRaw !== 0 || storageRaw !== 0) {
      const parts = [
        computeRaw !== 0 ? `Computes ${-computeRaw}%` : undefined,
        storageRaw !== 0 ? `Storages ${-storageRaw}%` : undefined
      ].filter(Boolean).join(' and ');
      discountsTitle = `(${parts})`;
    }
    let title = ReportsRouting.getTitle(this.report) || 'Report';
    if (discountsTitle) {
      title = title.concat(' ', discountsTitle);
    }
    const {start, endStrict} = getPeriod(this.period, this.range);
    let dates = this.period;
    if (start && endStrict) {
      dates = `${start.format('YYYY-MM-DD')} - ${endStrict.format('YYYY-MM-DD')}`;
    }
    let runner;
    if (
      this.runner &&
      this.runner.type === RunnerType.user &&
      users &&
      users.loaded
    ) {
      const userList = (users.value || [])
        .filter(({id}) => (this.runner.id || [])
          .filter((rId) => `${id}` === `${rId}`).length > 0
        );
      if (userList.length > 0) {
        runner = userList.map(u => u.userName).join(' ');
      } else {
        runner = `user ${this.runner.id.map(i => `#${i}`).join(' ')}`;
      }
    } else if (this.runner) {
      runner = `${this.runner.type} ${this.runner.id.join(' ')}`;
    }
    let regions;
    if (this.region && this.region.length) {
      if (cloudRegionsInfo && cloudRegionsInfo.loaded) {
        const cloudRegions = cloudRegionsInfo.value || [];
        const names = this.region
          .map(r => +r)
          .map(r => cloudRegions.find(cr => cr.id === r) || {name: `${r}`})
          .map(r => r.name);
        regions = `regions ${names.join(' ')}`;
      } else {
        regions = `regions ${this.region.join(' ')}`;
      }
    }
    return [
      title,
      dates,
      runner,
      regions
    ].filter(Boolean).join(' - ');
  };

  buildNavigationFn = (property) => e => this.navigate({[property]: e});

  periodNavigation = (period, range) => this.navigate({period, range}, true);

  reportNavigation = (report, runner) => this.navigate({report, runner});
}

export default Filter;
