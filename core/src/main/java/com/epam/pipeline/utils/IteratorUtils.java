package com.epam.pipeline.utils;

import java.util.Iterator;
import java.util.List;

public final class IteratorUtils {

    private IteratorUtils() {}

    public static <T> Iterator<List<T>> windowed(final Iterator<List<T>> iterator, final int windowSize) {
        return new WindowIterator<>(iterator, windowSize);
    }

    public static <T> Iterator<List<T>> chunked(final Iterator<T> iterator, final int chunkSize) {
        return new ChunkedIterator<>(iterator, chunkSize);
    }
}
