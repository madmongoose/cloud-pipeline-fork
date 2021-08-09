# Copyright 2017-2020 EPAM Systems, Inc. (https://www.epam.com/)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import io
import logging
import os

from fsclient import FileSystemClientDecorator
from fuseutils import MB


_ANY_ERROR = BaseException


class _FileBuffer(object):

    def __init__(self, offset, capacity):
        self._offset = offset
        self._current_offset = self._offset
        self._capacity = capacity
        self._buf = bytearray()

    @property
    def offset(self):
        return self._current_offset

    @property
    def size(self):
        return self._current_offset - self._offset

    @property
    def capacity(self):
        return self._capacity

    def append(self, buf):
        self._buf += buf
        self._current_offset += len(buf)


class _WriteBuffer(_FileBuffer):

    def __init__(self, offset, capacity, inherited_size=0):
        super(_WriteBuffer, self).__init__(offset, capacity)
        self._inherited_size = inherited_size

    @property
    def inherited_size(self):
        return max(self._current_offset, self._inherited_size)

    def suits(self, offset):
        return offset == self._current_offset

    def is_full(self):
        return self.size >= self.capacity

    def collect(self):
        return self._buf, self._offset


class _NewReadBuffer:

    def __init__(self, offset, file_size, capacity):
        self._offset = offset
        self._file_size = file_size
        self._capacity = capacity

        self._current_offset = self._offset
        self._buf = bytearray()
        self._bytes_read = 0
        self._last_append_length = 0

    @property
    def size(self):
        return self._current_offset - self._offset

    @property
    def start(self):
        return self._offset

    @property
    def end(self):
        return self._current_offset

    @property
    def bytes_read(self):
        return self._bytes_read

    @property
    def file_size(self):
        return self._file_size

    @property
    def capacity(self):
        return self.capacity

    @property
    def last_append_length(self):
        return self._last_append_length

    def append(self, buf):
        self._buf += buf
        self._current_offset += len(buf)
        self._last_append_length = len(buf)

    def suits(self, offset, length):
        return self._offset <= offset <= self._current_offset \
               and (offset + length <= self._current_offset
                    or self._current_offset == self._file_size)

    def view(self, offset, length):
        relative_start = offset - self._offset
        relative_end = min(offset + length, self._file_size) - self._offset
        self._bytes_read += relative_end - relative_start
        return self._buf[relative_start:relative_end]

    def shrink(self):
        size = self.size
        if size > self._capacity:
            shrink_size = size - self._capacity
            self._buf = self._buf[shrink_size:]
            self._offset += shrink_size


class BufferedFileSystemClient(FileSystemClientDecorator):

    _READ_AHEAD_MULTIPLIER = 1.1

    def __init__(self, inner, read_ahead_min_size, read_ahead_max_size, read_ahead_size_multiplier,
                 read_capacity, capacity):
        """
        Buffering file system client decorator.

        It merges multiple writes to temporary buffers to reduce number of calls to an inner file system client.

        It performs read ahead buffering.

        :param inner: Decorating file system client.
        :param read_ahead_min_size: Min amount of bytes that will be read ahead.
        :param read_ahead_max_size: Max amount of bytes that will be read ahead.
        :param read_ahead_size_multiplier: Next read ahead size multiplier.
        :param read_capacity: Single file read buffer capacity in bytes.
        :param capacity: Single file write buffer capacity in bytes.
        """
        super(BufferedFileSystemClient, self).__init__(inner)
        self._inner = inner
        self._read_ahead_min_size = read_ahead_min_size
        self._read_ahead_max_size = read_ahead_max_size
        self._read_ahead_size_multiplier = read_ahead_size_multiplier
        self._read_capacity = read_capacity
        self._capacity = capacity
        self._write_file_buffs = {}
        self._read_file_buffs = {}

    def attrs(self, path):
        attrs = self._inner.attrs(path)
        write_buf = self._write_file_buffs.get(path)
        if write_buf:
            attrs = attrs._replace(size=max(attrs.size, write_buf.inherited_size))
        return attrs

    def download_range(self, fh, buf, path, offset=0, length=0):
        try:
            buf_key = fh, path
            file_buf = self._read_file_buffs.get(buf_key)
            if not file_buf:
                file_size = self._inner.attrs(path).size
                if not file_size or offset >= file_size:
                    return
                file_buf = self._new_read_buf(fh, path, file_size, offset, length)
                self._read_file_buffs[buf_key] = file_buf
            if not file_buf.suits(offset, length):
                read_length = max(min(file_buf.last_append_length * self._read_ahead_size_multiplier,
                                      self._read_ahead_max_size), length)
                if offset >= file_buf.start and offset + length <= file_buf.end + read_length:
                    file_buf.append(self._read_ahead(fh, path, file_buf.end, length=read_length))
                    file_buf.shrink()
                else:
                    file_buf = self._new_read_buf(fh, path, file_buf.file_size, offset, length)
                    self._read_file_buffs[buf_key] = file_buf
            buf.write(file_buf.view(offset, length))
        except _ANY_ERROR:
            logging.exception('Downloading has failed for %d:%s. '
                              'Removing read buffer.' % (fh, path))
            self._remove_read_buf(fh, path)
            raise

    def _new_read_buf(self, fh, path, file_size, offset, length):
        file_buf = _NewReadBuffer(offset, file_size, self._read_capacity)
        file_buf.append(self._read_ahead(fh, path, offset, length=max(self._read_ahead_min_size, length)))
        return file_buf

    def _read_ahead(self, fh, path, offset, length):
        with io.BytesIO() as read_ahead_buf:
            logging.info('Downloading buffer range %d-%d for %d:%s' % (offset, offset + length, fh, path))
            self._inner.download_range(fh, read_ahead_buf, path, offset, length=length)
            return read_ahead_buf.getvalue()

    def upload_range(self, fh, buf, path, offset=0):
        try:
            file_buf = self._write_file_buffs.get(path)
            if not file_buf:
                file_buf = self._new_write_buf(self._capacity, offset)
                self._write_file_buffs[path] = file_buf
            if file_buf.suits(offset):
                file_buf.append(buf)
            else:
                logging.info('Upload buffer is not sequential for %d:%s. Buffer will be cleared.' % (fh, path))
                self._flush_write_buf(fh, path)
                old_file_buf = self._remove_write_buf(fh, path)
                file_buf = self._new_write_buf(self._capacity, offset, buf, old_file_buf)
                self._write_file_buffs[path] = file_buf
            if file_buf.is_full():
                logging.info('Upload buffer is full for %d:%s. Buffer will be cleared.' % (fh, path))
                self._flush_write_buf(fh, path)
                self._remove_write_buf(fh, path)
                file_buf = self._new_write_buf(self._capacity, file_buf.offset, buf=None, old_write_buf=file_buf)
                self._write_file_buffs[path] = file_buf
        except _ANY_ERROR:
            logging.exception('Uploading has failed for %d:%s. '
                              'Removing write buffer.' % (fh, path))
            self._remove_write_buf(fh, path)
            raise

    def _new_write_buf(self, capacity, offset, buf=None, old_write_buf=None):
        write_buf = _WriteBuffer(offset, capacity, inherited_size=old_write_buf.inherited_size if old_write_buf else 0)
        if buf:
            write_buf.append(buf)
        return write_buf

    def flush(self, fh, path):
        try:
            logging.info('Flushing buffers for %d:%s' % (fh, path))
            self._flush_write_buf(fh, path)
            self._inner.flush(fh, path)
            self._remove_read_buf(fh, path)
            self._remove_write_buf(fh, path)
        except _ANY_ERROR:
            logging.exception('Flushing has failed for %d:%s. '
                              'Removing read and write buffers.' % (fh, path))
            self._remove_read_buf(fh, path)
            self._remove_write_buf(fh, path)
            raise

    def _remove_read_buf(self, fh, path):
        return self._read_file_buffs.pop((fh, path), None)

    def _remove_write_buf(self, fh, path):
        return self._write_file_buffs.pop(path, None)

    def _flush_write_buf(self, fh, path):
        write_buf = self._write_file_buffs.get(path, None)
        if write_buf:
            collected_buf, collected_offset = write_buf.collect()
            if collected_buf:
                logging.info('Uploading buffer range %d-%d for %d:%s'
                             % (collected_offset, collected_offset + len(collected_buf), fh, path))
                self._inner.upload_range(fh, collected_buf, path, collected_offset)
        return write_buf
