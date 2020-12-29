from ..utils import as_size, as_literal, assert_content
from pyfs import truncate, rm, touch


def test_truncate_from_empty_to_size(size, local_file, mount_file, source_path):
    touch(local_file)
    touch(mount_file)
    rm(local_file)
    rm(mount_file)
    truncate(local_file, size)
    truncate(mount_file, size)
    assert_content(local_file, mount_file)


def test_truncate_from_size_to_size(size, local_file, mount_file, source_path):
    truncate(local_file, size)
    truncate(mount_file, size)
    assert_content(local_file, mount_file)


def test_truncate_from_size_to_half_size(size, local_file, mount_file, source_path):
    truncate(local_file, as_literal(as_size(size) / 2))
    truncate(mount_file, as_literal(as_size(size) / 2))
    assert_content(local_file, mount_file)


def test_truncate_from_half_size_to_empty(size, local_file, mount_file, source_path):
    truncate(local_file, '0')
    truncate(mount_file, '0')
    assert_content(local_file, mount_file)


def test_truncate_from_empty_to_empty(size, local_file, mount_file, source_path):
    truncate(local_file, size)
    truncate(mount_file, size)
    assert_content(local_file, mount_file)
