package com.epam.pipeline.manager.billing;

import com.epam.pipeline.controller.vo.billing.BillingExportRequest;
import com.epam.pipeline.controller.vo.billing.BillingExportType;
import com.epam.pipeline.entity.billing.RunBilling;
import com.epam.pipeline.exception.search.SearchException;
import com.epam.pipeline.manager.preference.PreferenceManager;
import com.epam.pipeline.manager.preference.SystemPreferences;
import com.epam.pipeline.manager.utils.GlobalSearchElasticHelper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.action.support.IndicesOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.search.aggregations.Aggregations;
import org.elasticsearch.search.aggregations.bucket.terms.ParsedStringTerms;
import org.elasticsearch.search.aggregations.bucket.terms.ParsedTerms;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.IntStream;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class RunBillingExporter implements BillingExporter {

    @Getter
    private final BillingExportType type = BillingExportType.RUN;
    private final BillingHelper billingHelper;
    private final GlobalSearchElasticHelper elasticHelper;
    private final PreferenceManager preferenceManager;

    @Override
    public void export(final BillingExportRequest request, final OutputStream out) {
        try (OutputStreamWriter outputStreamWriter = new OutputStreamWriter(out);
             BufferedWriter bufferedWriter = new BufferedWriter(outputStreamWriter);
             RunBillingWriter writer = new RunBillingWriter(bufferedWriter, billingHelper, preferenceManager);
             RestClient elasticSearchLowLevelClient = elasticHelper.buildLowLevelClient()) {
            final RestHighLevelClient elasticSearchClient = new RestHighLevelClient(elasticSearchLowLevelClient);
            writer.writeHeader();
            runBillings(elasticSearchClient, request).forEach(writer::write);
        } catch (IOException e) {
            log.error(e.getMessage(), e);
            throw new SearchException(e.getMessage(), e);
        }
    }

    public Stream<RunBilling> runBillings(final RestHighLevelClient elasticSearchClient,
                                          final BillingExportRequest request) {
        final LocalDate from = request.getFrom();
        final LocalDate to = request.getTo();
        final Map<String, List<String>> filters = billingHelper.getFilters(request.getFilters());
        final int numberOfPartitions = getEstimatedNumberOfRunBillingPartitions(elasticSearchClient, from, to, filters);
        return runBillings(elasticSearchClient, from, to, filters, numberOfPartitions);
    }

    private int getEstimatedNumberOfRunBillingPartitions(final RestHighLevelClient elasticSearchClient,
                                                         final LocalDate from,
                                                         final LocalDate to,
                                                         final Map<String, List<String>> filters) {
        return BigDecimal.valueOf(getEstimatedNumberOfRunBillings(elasticSearchClient, from, to, filters))
                .divide(BigDecimal.valueOf(getPartitionSize()), RoundingMode.CEILING)
                .max(BigDecimal.ONE)
                .intValue();
    }

    private int getEstimatedNumberOfRunBillings(final RestHighLevelClient elasticsearchClient,
                                                final LocalDate from,
                                                final LocalDate to,
                                                final Map<String, List<String>> filters) {
        return Optional.of(getEstimatedNumberOfRunBillingsRequest(from, to, filters))
                .map(searchWith(elasticsearchClient))
                .map(SearchResponse::getAggregations)
                .flatMap(billingHelper::getCardinalityByRunId)
                .orElse(NumberUtils.INTEGER_ZERO);
    }

    private SearchRequest getEstimatedNumberOfRunBillingsRequest(final LocalDate from,
                                                                 final LocalDate to,
                                                                 final Map<String, List<String>> filters) {
        return new SearchRequest()
                .indicesOptions(IndicesOptions.strictExpandOpen())
                .indices(billingHelper.runIndicesByDate(from, to))
                .source(new SearchSourceBuilder()
                        .size(0)
                        .query(billingHelper.queryByDateAndFilters(from, to, filters))
                        .aggregation(billingHelper.aggregateCardinalityByRunId()));
    }

    private int getPartitionSize() {
        return Optional.of(SystemPreferences.BILLING_EXPORT_AGGREGATION_PARTITION_SIZE)
                .map(preferenceManager::getPreference)
                .orElse(BillingHelper.FALLBACK_EXPORT_AGGREGATION_PARTITION_SIZE);
    }

    private Stream<RunBilling> runBillings(final RestHighLevelClient elasticSearchClient,
                                           final LocalDate from,
                                           final LocalDate to,
                                           final Map<String, List<String>> filters,
                                           final int numberOfPartitions) {
        return IntStream.range(0, numberOfPartitions)
                .mapToObj(partition -> getRunBillingsRequest(from, to, filters, partition, numberOfPartitions))
                .map(searchWith(elasticSearchClient))
                .flatMap(this::getRunBillings);
    }

    private SearchRequest getRunBillingsRequest(final LocalDate from,
                                                final LocalDate to,
                                                final Map<String, List<String>> filters,
                                                final int partition,
                                                final int numberOfPartitions) {
        return new SearchRequest()
                .indicesOptions(IndicesOptions.strictExpandOpen())
                .indices(billingHelper.runIndicesByDate(from, to))
                .source(new SearchSourceBuilder()
                        .size(0)
                        .query(billingHelper.queryByDateAndFilters(from, to, filters))
                        .aggregation(billingHelper.aggregatePartitionByRunId(partition, numberOfPartitions)
                                .subAggregation(billingHelper.aggregateCostSum())
                                .subAggregation(billingHelper.aggregateRunUsageSum())
                                .subAggregation(billingHelper.aggregateLastByDateDoc())));
    }

    private Function<SearchRequest, SearchResponse> searchWith(final RestHighLevelClient elasticSearchClient) {
        return request -> {
            try {
                log.debug("Billing request: {}", request);
                return elasticSearchClient.search(request);
            } catch (IOException e) {
                log.error(e.getMessage(), e);
                throw new SearchException(e.getMessage(), e);
            }
        };
    }

    private Stream<RunBilling> getRunBillings(final SearchResponse searchResponse) {
        return Optional.ofNullable(searchResponse.getAggregations())
                .map(it -> it.get(BillingHelper.RUN_ID_FIELD))
                .filter(ParsedStringTerms.class::isInstance)
                .map(ParsedStringTerms.class::cast)
                .map(ParsedTerms::getBuckets)
                .map(Collection::stream)
                .orElse(Stream.empty())
                .filter(bucket -> bucket.getKey() instanceof String)
                .map(bucket -> getRunBilling((String) bucket.getKey(), bucket.getAggregations()));
    }

    private RunBilling getRunBilling(final String runId, final Aggregations aggregations) {
        final Optional<Long> cost = billingHelper.getCostSum(aggregations);
        final Optional<Long> duration = billingHelper.getRunUsageSum(aggregations);
        final Map<String, Object> topHitFields = billingHelper.getLastByDateDocFields(aggregations);
        return RunBilling.builder()
                .runId(NumberUtils.toLong(runId))
                .owner(billingHelper.asString(topHitFields.get(BillingHelper.OWNER_FIELD)))
                .billingCenter(billingHelper.asString(topHitFields.get(BillingHelper.BILLING_CENTER_FIELD)))
                .pipeline(billingHelper.asString(topHitFields.get(BillingHelper.PIPELINE_FIELD)))
                .tool(billingHelper.asString(topHitFields.get(BillingHelper.TOOL_FIELD)))
                .computeType(billingHelper.asString(topHitFields.get(BillingHelper.COMPUTE_TYPE_FIELD)))
                .instanceType(billingHelper.asString(topHitFields.get(BillingHelper.INSTANCE_TYPE_FIELD)))
                .started(billingHelper.asDateTime(topHitFields.get(BillingHelper.STARTED_FIELD)))
                .finished(billingHelper.asDateTime(topHitFields.get(BillingHelper.FINISHED_FIELD)))
                .duration(duration.orElse(0L))
                .cost(cost.orElse(0L))
                .build();
    }
}
