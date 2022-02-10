package com.epam.pipeline.dto.datastorage.security;

import lombok.Value;

import java.util.List;

@Value
public class StoragePermissionMoveBatchRequest {

    Long id;
    StorageKind type;
    List<StoragePermissionMoveRequest> requests;
}
