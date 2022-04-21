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

package com.epam.pipeline.dts.deletion.rest.dto;

import com.epam.pipeline.dts.transfer.rest.dto.StorageItemDTO;
import com.epam.pipeline.entity.dts.transfer.TaskStatus;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
public class DeletionDTO {

    private Long id;
    private StorageItemDTO target;
    private TaskStatus status;
    private String reason;
    private LocalDateTime created;
    private LocalDateTime scheduled;
    private LocalDateTime started;
    private LocalDateTime finished;
    private List<String> included;
    private String user;

}
