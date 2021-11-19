/*
 * Copyright 2017-2021 EPAM Systems, Inc. (https://www.epam.com/)
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

ALTER TABLE pipeline.datastorage ADD source_datastorage_id BIGINT DEFAULT NULL;
ALTER TABLE pipeline.datastorage ADD masking_rules JSONB DEFAULT NULL;
ALTER TABLE pipeline.datastorage
    ADD CONSTRAINT datastorage_linked_storage_id_fk FOREIGN KEY (source_datastorage_id)
        REFERENCES pipeline.datastorage(datastorage_id) ON DELETE CASCADE;
