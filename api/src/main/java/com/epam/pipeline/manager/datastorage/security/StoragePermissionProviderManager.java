package com.epam.pipeline.manager.datastorage.security;

import com.epam.pipeline.entity.AbstractSecuredEntity;
import com.epam.pipeline.entity.SecuredStorageEntity;
import com.epam.pipeline.entity.datastorage.AbstractDataStorageItem;
import com.epam.pipeline.dto.datastorage.security.StoragePermission;
import com.epam.pipeline.dto.datastorage.security.StoragePermissionPathType;
import com.epam.pipeline.dto.datastorage.security.StoragePermissionSid;
import com.epam.pipeline.dto.datastorage.security.StoragePermissionSidType;
import com.epam.pipeline.entity.user.PipelineUser;
import com.epam.pipeline.entity.user.Role;
import com.epam.pipeline.manager.security.AuthManager;
import com.epam.pipeline.manager.security.CheckPermissionHelper;
import com.epam.pipeline.manager.security.GrantPermissionManager;
import com.epam.pipeline.manager.security.PermissionsService;
import com.epam.pipeline.repository.datastorage.security.StoragePermissionRepository;
import com.epam.pipeline.security.acl.AclPermission;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.acls.model.Permission;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class StoragePermissionProviderManager {

    private final StoragePermissionManager storagePermissionManager;
    private final PermissionsService permissionsService;
    private final GrantPermissionManager grantPermissionManager;
    private final AuthManager authManager;

    public boolean isReadAllowed(final SecuredStorageEntity storage,
                                 final String path,
                                 final StoragePermissionPathType type) {
        return isAllowed(storage, path, type, AclPermission.READ);
    }

    public boolean isReadNotAllowed(final SecuredStorageEntity storage,
                                    final String path,
                                    final StoragePermissionPathType type) {
        return !isReadAllowed(storage, path, type);
    }

    public boolean isWriteAllowed(final SecuredStorageEntity storage, final String path,
                                  final StoragePermissionPathType type) {
        return isAllowed(storage, path, type, AclPermission.WRITE);
    }

    public boolean isWriteNotAllowed(final SecuredStorageEntity storage,
                                     final String path,
                                     final StoragePermissionPathType type) {
        return !isWriteAllowed(storage, path, type);
    }

    private boolean isAllowed(final SecuredStorageEntity storage,
                              final String path,
                              final StoragePermissionPathType type,
                              final Permission... permissions) {
        final String absolutePath = storage.resolveAbsolutePath(path);
        final int mask = getExtendedMask(storage, absolutePath, type);
        return isAllowed(mask, permissions);
    }

    private boolean isAllowed(final int mask, final Permission... permissions) {
        return Arrays.stream(permissions).allMatch(permission -> isAllowed(mask, permission));
    }

    private boolean isAllowed(final int mask, final Permission permission) {
        return permission instanceof AclPermission
                && (permission.getMask() & mask) == permission.getMask()
                && (((AclPermission) permission).getDenyPermission().getMask() & mask) == 0;
    }

    public boolean isRecursiveReadAllowed(final SecuredStorageEntity storage, final String path) {
        return isRecursiveAllowed(storage, path, AclPermission.READ);
    }

    public boolean isRecursiveReadNotAllowed(final SecuredStorageEntity storage, final String path) {
        return !isRecursiveReadAllowed(storage, path);
    }

    public boolean isRecursiveWriteAllowed(final SecuredStorageEntity storage, final String path) {
        return isRecursiveAllowed(storage, path, AclPermission.WRITE);
    }

    public boolean isRecursiveWriteNotAllowed(final SecuredStorageEntity storage, final String path) {
        return !isRecursiveWriteAllowed(storage, path);
    }

    public boolean isRecursiveReadWriteAllowed(final SecuredStorageEntity storage, final String path) {
        return isRecursiveAllowed(storage, path, AclPermission.READ, AclPermission.WRITE);
    }

    public boolean isRecursiveReadWriteNotAllowed(final SecuredStorageEntity storage, final String path) {
        return !isRecursiveReadWriteAllowed(storage, path);
    }

    private boolean isRecursiveAllowed(final SecuredStorageEntity storage,
                                       final String path,
                                       final Permission... permissions) {
        final PipelineUser user = authManager.getCurrentUser();
        if (user == null) {
            return false;
        }
        if (user.isAdmin() || Objects.equals(user.getUserName(), storage.getOwner())) {
            return true;
        }
        final List<String> groups = groupSids(user)
                .map(StoragePermissionSid::getName)
                .collect(Collectors.toList());
        return storagePermissionManager.loadAggregatedMask(storage.getRootId(), path, user.getUserName(), groups)
                .map(mask -> isAllowed(mask, permissions))
                .orElseGet(() -> isAllowed(storage, path, StoragePermissionPathType.FOLDER, permissions));
    }

    public List<AbstractDataStorageItem> process(final SecuredStorageEntity storage,
                                                 final String path,
                                                 final List<AbstractDataStorageItem> items) {
        final String absolutePath = Optional.ofNullable(storage.resolveAbsolutePath(path)).orElse(StringUtils.EMPTY);
        final PipelineUser user = authManager.getCurrentUser();
        if (user == null) {
            return Collections.emptyList();
        }
        if (user.isAdmin() || Objects.equals(user.getUserName(), storage.getOwner())) {
            return items.stream()
                    .map(item -> withMask(item, AbstractSecuredEntity.ALL_PERMISSIONS_MASK))
                    .collect(Collectors.toList());
        }
        final List<String> groups = groupSids(user)
                .map(StoragePermissionSid::getName)
                .collect(Collectors.toList());
        final Map<StoragePermissionRepository.StorageItemImpl, Integer> masksmap = storagePermissionManager
                .loadDirectChildPermissions(storage.getRootId(), path, user.getUserName(), groups)
                .stream()
                .collect(Collectors.toMap(item -> new StoragePermissionRepository.StorageItemImpl(
                        item.getDatastoragePath(), item.getDatastorageType()),
                        StoragePermissionRepository.StorageItemWithMask::getMask));
        final int mask = getExtendedMask(storage, path, StoragePermissionPathType.FOLDER);
        if (isAllowed(mask, AclPermission.READ)) {
            return items.stream()
                    .map(item -> withMask(item, masksmap.getOrDefault(new StoragePermissionRepository.StorageItemImpl(
                            item.getPath(), StoragePermissionPathType.from(item.getType())), mask)))
                    .collect(Collectors.toList());
        } else {
            final Set<StoragePermissionRepository.StorageItem> readAllowedItems =
                    storagePermissionManager.loadReadAllowedDirectChildItems(storage.getRootId(), absolutePath, user.getUserName(), groups);
            if (readAllowedItems.isEmpty()) {
                // TODO: 23.08.2021 Move this check to SecuredStorageProvider
                throw new AccessDeniedException(String.format("No recursive read permissions for %s", path));
            }
            return items.stream()
                    .filter(item -> readAllowedItems.contains(new StoragePermissionRepository.StorageItemImpl(item.getPath(),
                            StoragePermissionPathType.from(item.getType()))))
                    .map(item -> withMask(item, masksmap.getOrDefault(
                            new StoragePermissionRepository.StorageItemImpl(
                                    item.getPath(), StoragePermissionPathType.from(item.getType())), mask)
                            | AclPermission.READ.getMask()))
                    .collect(Collectors.toList());
        }
    }

    private AbstractDataStorageItem withMask(final AbstractDataStorageItem item, final int mask) {
        item.setMask(mask);
        return item;
    }

    private int getMask(final SecuredStorageEntity storage, final AbstractDataStorageItem item) {
        return getMask(storage, item.getPath(), StoragePermissionPathType.from(item.getType()));
    }

    public int getMask(final SecuredStorageEntity storage, final String path, final StoragePermissionPathType type) {
        return permissionsService.mergeMask(getExtendedMask(storage, path, type));
    }

    private int getExtendedMask(final SecuredStorageEntity storage,
                                final String path,
                                final StoragePermissionPathType type) {
        final PipelineUser user = authManager.getCurrentUser();
        if (user == null) {
            return AbstractSecuredEntity.NO_PERMISSIONS_MASK;
        }
        if (user.isAdmin() || Objects.equals(user.getUserName(), storage.getOwner())) {
            return AbstractSecuredEntity.ALL_PERMISSIONS_MASK_FULL;
        }
        return getExtendedMask(storage, path, type, user);
    }

    private int getExtendedMask(final SecuredStorageEntity storage,
                                final String path,
                                final StoragePermissionPathType type,
                                final PipelineUser user) {
        // TODO: 17.08.2021 User permissions should override group permissions
        final String absolutePath = Optional.ofNullable(storage.resolveAbsolutePath(path)).orElse(StringUtils.EMPTY);
        final List<StoragePermissionSid> sids = getSids(user);
        final List<StoragePermission> permissions = storagePermissionManager.load(storage.getRootId(), absolutePath,
                type);
        final List<StoragePermission> applicablePermissions = permissions.stream()
                .filter(it -> sids.contains(it.getSid()))
                .collect(Collectors.toList());
        final List<StoragePermission> directPermissions = applicablePermissions.stream()
                .filter(it -> Objects.equals(it.getPath(), absolutePath))
                .collect(Collectors.toList());
        return directPermissions.isEmpty()
                ? getExtendedMask(storage, applicablePermissions)
                : getExtendedMask(storage, directPermissions);
    }

    private int getExtendedMask(final SecuredStorageEntity storage, final List<StoragePermission> permissions) {
        return permissions.isEmpty()
                ? grantPermissionManager.getPermissionsMask((AbstractSecuredEntity) storage, false, true)
                : getMergedUserPrioritisedMask(permissions);
    }

    private int getMergedUserPrioritisedMask(final List<StoragePermission> permissions) {
        return permissions.stream()
                .filter(perm -> perm.getSid().getType() == StoragePermissionSidType.USER)
                .findFirst()
                .map(StoragePermission::getMask)
                .orElseGet(() -> getMergedMask(permissions));
    }

    private Integer getMergedMask(final List<StoragePermission> permissions) {
        return permissions.stream()
                .map(StoragePermission::getMask)
                .reduce(0, (x, y) -> x | y);
    }

    private List<StoragePermissionSid> getSids(final PipelineUser user) {
        return Stream.concat(userSids(user), groupSids(user)).collect(Collectors.toList());
    }

    private Stream<StoragePermissionSid> groupSids(final PipelineUser user) {
        return Optional.of(user)
                .map(PipelineUser::getRoles)
                .map(List::stream)
                .orElseGet(Stream::empty)
                .map(Role::getName)
                .filter(Objects::nonNull)
                .map(StoragePermissionSid::group);
    }

    private Stream<StoragePermissionSid> userSids(final PipelineUser user) {
        return Optional.of(user)
                .map(PipelineUser::getUserName)
                .map(StoragePermissionSid::user)
                .map(Stream::of)
                .orElseGet(Stream::empty);
    }

    public void deleteFilePermissions(final SecuredStorageEntity storage,
                                      final String path,
                                      final String version,
                                      final boolean totally) {
        if (!storage.isVersioningEnabled() || version == null || totally) {
            storagePermissionManager.delete(storage.getRootId(), path, StoragePermissionPathType.FILE);
        }
    }

    public void deleteFolderPermissions(final SecuredStorageEntity storage, final String path) {
        storagePermissionManager.delete(storage.getRootId(), path, StoragePermissionPathType.FOLDER);
    }

    public void moveFilePermissions(final SecuredStorageEntity storage, final String oldPath, final String newPath) {
        storagePermissionManager.copy(storage.getRootId(), oldPath, newPath, StoragePermissionPathType.FILE);
        storagePermissionManager.delete(storage.getRootId(), oldPath, StoragePermissionPathType.FILE);
    }

    public void moveFolderPermissions(final SecuredStorageEntity storage, final String oldPath, final String newPath) {
        storagePermissionManager.copy(storage.getRootId(), oldPath, newPath, StoragePermissionPathType.FOLDER);
        storagePermissionManager.delete(storage.getRootId(), oldPath, StoragePermissionPathType.FOLDER);
    }

    public void copyFilePermissions(final SecuredStorageEntity storage, final String oldPath, final String newPath) {
        storagePermissionManager.copy(storage.getRootId(), oldPath, newPath, StoragePermissionPathType.FILE);
    }

    public void copyFolderPermissions(final SecuredStorageEntity storage, final String oldPath, final String newPath) {
        storagePermissionManager.copy(storage.getRootId(), oldPath, newPath, StoragePermissionPathType.FOLDER);
    }
}
