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
package com.epam.pipeline.billingreportagent.service.impl.loader;

import com.epam.pipeline.billingreportagent.model.EntityContainer;
import com.epam.pipeline.billingreportagent.model.EntityWithMetadata;
import com.epam.pipeline.billingreportagent.service.EntityLoader;
import com.epam.pipeline.billingreportagent.service.impl.CloudPipelineAPIClient;
import com.epam.pipeline.entity.datastorage.AbstractDataStorage;
import com.epam.pipeline.entity.security.acl.AclClass;
import com.epam.pipeline.entity.user.PipelineUser;
import com.epam.pipeline.vo.EntityVO;
import org.apache.commons.collections4.ListUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class StorageLoader implements EntityLoader<AbstractDataStorage> {

    private final CloudPipelineAPIClient apiClient;
    private final String storageExcludeKey;
    private final String storageExcludeValue;

    public StorageLoader(final CloudPipelineAPIClient apiClient,
                         @Value("${sync.storage.billing.exclude.metadata.key:Billing status}")
                         final String storageExcludeKey,
                         @Value("${sync.storage.billing.exclude.metadata.value:Exclude}")
                         final String storageExcludeValue) {
        this.apiClient = apiClient;
        this.storageExcludeKey = storageExcludeKey;
        this.storageExcludeValue = storageExcludeValue;
    }

    @Override
    public List<EntityContainer<AbstractDataStorage>> loadAllEntities() {
        final Map<String, EntityWithMetadata<PipelineUser>> usersWithMetadata = prepareUsers(apiClient);
        final Set<Long> storageIdsToIgnore = loadStorageIdsToIgnoreByTag();
        return apiClient.loadAllDataStorages()
                .stream()
                .filter(storage -> isStorageBillable(storage, storageIdsToIgnore))
                .map(storage -> EntityContainer.<AbstractDataStorage>builder()
                        .entity(storage)
                        .owner(usersWithMetadata.get(storage.getOwner()))
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    public List<EntityContainer<AbstractDataStorage>> loadAllEntitiesActiveInPeriod(final LocalDateTime from,
                                                                                    final LocalDateTime to) {
        return loadAllEntities();
    }

    private Set<Long> loadStorageIdsToIgnoreByTag() {
        return ListUtils.emptyIfNull(
                apiClient.searchEntriesByMetadata(AclClass.DATA_STORAGE, storageExcludeKey, storageExcludeValue))
            .stream()
            .map(EntityVO::getEntityId)
            .collect(Collectors.toSet());
    }

    private boolean isStorageBillable(final AbstractDataStorage storage, final Set<Long> storageIdsToIgnore) {
        return !storage.isShared() && !storageIdsToIgnore.contains(storage.getId());
    }
}
