/*
 * Copyright 2017-2020 EPAM Systems, Inc. (https://www.epam.com/)
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.epam.pipeline.acl.cluster.pool;

import com.epam.pipeline.controller.vo.cluster.pool.NodePoolVO;
import com.epam.pipeline.entity.cluster.pool.NodePool;
import com.epam.pipeline.entity.cluster.pool.NodePoolUsage;
import com.epam.pipeline.manager.cluster.pool.NodePoolManager;
import com.epam.pipeline.manager.cluster.pool.NodePoolUsageService;
import com.epam.pipeline.security.acl.AclExpressions;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NodePoolApiService {

    private final NodePoolManager nodeManager;
    private final NodePoolUsageService nodePoolUsageService;

    @PreAuthorize(AclExpressions.ADMIN_ONLY)
    public List<NodePool> loadAll() {
        return nodeManager.loadAll();
    }

    @PreAuthorize(AclExpressions.ADMIN_ONLY)
    public NodePool load(final Long poolId) {
        return nodeManager.load(poolId);
    }

    @PreAuthorize(AclExpressions.ADMIN_ONLY)
    public NodePool createOrUpdate(final NodePoolVO vo) {
        return nodeManager.createOrUpdate(vo);
    }

    @PreAuthorize(AclExpressions.ADMIN_ONLY)
    public NodePool delete(final Long poolId) {
        return nodeManager.delete(poolId);
    }

    @PreAuthorize(AclExpressions.ADMIN_ONLY)
    public List<NodePoolUsage> saveUsage(final List<NodePoolUsage> records) {
        return nodePoolUsageService.save(records);
    }

    @PreAuthorize(AclExpressions.ADMIN_ONLY)
    public Boolean deleteUsage(final LocalDate date) {
        return nodePoolUsageService.deleteExpired(date);
    }
}
