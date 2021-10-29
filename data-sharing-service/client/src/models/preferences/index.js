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

import Remote from '../basic/Remote';
import {computed} from 'mobx';

class Preferences extends Remote {
  constructor () {
    super();
    this.url = '/preferences';
  }

  getPreferenceValue = (options) => {
    if (!this.loaded || !this.value) {
      return undefined;
    }
    let group, key;
    if (options && typeof options === 'string') {
      key = options;
    } else if (typeof options === 'object') {
      group = options.group;
      key = options.key;
    }
    if (!key) {
      return undefined;
    }
    try {
      const preferenceGroup = group ? this.value[group] : undefined;
      if (preferenceGroup) {
        return preferenceGroup[key];
      }
      if (this.value[key]) {
        return this.value[key];
      }
      const allGroups = Object.values(this.value || {});
      for (const someGroup of allGroups) {
        if (someGroup[key]) {
          return someGroup[key];
        }
      }
    } catch (_) {}
    return undefined;
  };

  @computed
  get dataSharingDownloadEnabled () {
    const value = this.getPreferenceValue('data.sharing.download.enabled');
    if (value) {
      return `${value}` === 'true';
    }
    return true;
  }
}

export {Preferences};
export default new Preferences();
