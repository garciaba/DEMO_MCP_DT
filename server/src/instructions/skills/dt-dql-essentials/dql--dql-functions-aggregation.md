# DQL Functions — Aggregation

Param notation: `name` = required positional · `name:` = required named · suffix `*` = variadic · suffix `?` = optional · types listed as `|`-separated names or `any` (all scalar+collection types)

## Table of Contents

[`avg`](#avg) · [`collectArray`](#collectarray) · [`collectDistinct`](#collectdistinct) · [`correlation`](#correlation) · [`count`](#count) · [`countDistinct`](#countdistinct) · [`countDistinctApprox`](#countdistinctapprox) · [`countDistinctExact`](#countdistinctexact) · [`countIf`](#countif) · [`max`](#max) · [`median`](#median) · [`min`](#min) · [`percentRank`](#percentrank) · [`percentile`](#percentile) · [`percentileFromSamples`](#percentilefromsamples) · [`percentiles`](#percentiles) · [`stddev`](#stddev) · [`sum`](#sum) · [`takeAny`](#takeany) · [`takeFirst`](#takefirst) · [`takeLast`](#takelast) · [`takeMax`](#takemax) · [`takeMin`](#takemin) · [`variance`](#variance)

## `avg`
Calculates the average value of a field for a list of records.
`avg(expression)`
  `expression` (Double|Duration|Long) — The expression from which to compute the average.
  → Double|Duration

## `collectArray`
Collects the values of the provided field into an array (preservation of order not guaranteed).
`collectArray(expression [, maxLength] [, expand])`
  `expression` (any) — The expression from which to collect the values.
  `maxLength:?` (Long) — The maximum length of the resulting array.  [min:0]
  `expand:?` (Boolean) — The boolean expression that indicates whether the output should be a flat array.  [default:FALSE]
  → Array

## `collectDistinct`
Collects the values of the provided field into an array (preservation of order not guaranteed).
`collectDistinct(expression [, maxLength] [, expand])`
  `expression` (any) — The expression from which to collect the distinct values.
  `maxLength:?` (Long) — The maximum length of the resulting array.  [min:0]
  `expand:?` (Boolean) — The boolean expression that indicates whether the output should be a flat array.  [default:FALSE]
  → Array

## `correlation`
Calculates the correlation of two fields for a list of records.
`correlation(expression1, expression2)`
  `expression1` (Double|Long) — The first expression to correlate.
  `expression2` (Double|Long) — The second expression to correlate.
  → Double

## `count`
Counts the total number of records.
`count()`
  → Long

## `countDistinct`
Calculates the cardinality of unique values of a field for a list of records based on a stochastic estimation.
`countDistinct(expression [, precision])`
  `expression` (any) — The expression from which to count distinct elements.
  `precision:?` (Long) — The precision in the interval [3, 16].  [default:14, min:3]
  → Long

## `countDistinctApprox`
Calculates the cardinality of unique values of a field for a list of records based on a stochastic estimation.
`countDistinctApprox(expression [, precision])`
  `expression` (any) — The expression from which to count distinct elements.
  `precision:?` (Long) — The precision in the interval [3, 16].  [default:14, min:3]
  → Long

## `countDistinctExact`
Calculates the cardinality of unique values of a field for a list of records.
`countDistinctExact(expression)`
  `expression` (any) — The expression from which to count distinct elements.
  → Long

## `countIf`
Counts the number of records that match the condition.
`countIf(condition)`
  `condition` (Boolean) — The expression from which to count matched elements.
  → Long

## `max`
Calculates the maximum value of a field for a list of records.
`max(expression)`
  `expression` (Boolean|Double|Duration|Long|String|Timestamp) — The expression from which to get the maximum element.
  → Boolean|Double|Duration|Long|String|Timestamp

## `median`
Calculates the median value of a field for a list of records.
`median(expression [, weight])`
  `expression` (Boolean|Double|Duration|Long|Timestamp) — The expression from which to compute the median.
  `weight:?` (Double|Long) — The weight of the corresponding expression (e.g. its sampling ratio).  [default:1, min:0]
  → Boolean|Double|Duration|Timestamp

## `min`
Calculates the minimum value of a field for a list of records.
`min(expression)`
  `expression` (Boolean|Double|Duration|Long|String|Timestamp) — The expression from which to get the minimum element.
  → Boolean|Double|Duration|Long|String|Timestamp

## `percentRank`
Calculates the percentile rank for a given value.
`percentRank(expression, value)`
  `expression` (Boolean|Double|Duration|Long|Timestamp) — The expression for which to compute a percentile rank.
  `value` (Boolean|Double|Duration|Long|Timestamp) — The value for which to retrieve the percentile.
  → Double

## `percentile`
Calculates the percentile value of a field for a list of records:percentile(x, 50) == median(x).
`percentile(expression, percentile [, weight])`
  `expression` (Boolean|Double|Duration|Long|Timestamp) — The expression from which to compute a percentile.
  `percentile` (Double|Long) — The percentile to compute, between 0 and 100.  [min:0]
  `weight:?` (Double|Long) — The weight of the corresponding expression (e.g. its sampling ratio).  [default:1, min:0]
  → Boolean|Double|Duration|Timestamp

## `percentileFromSamples`
Calculates the percentile value of array fields.
`percentileFromSamples(expression, percentile [, originalCount])`
  `expression` (Array) — The array expression from which to compute a percentile.
  `percentile` (Double|Long) — The percentile to compute, between 0 and 100.  [min:0]
  `originalCount:?` (Double|Long) — The original element count of the given array expression.  [min:0]
  → Boolean|Double|Duration|Timestamp

## `percentiles`
Calculates multiple percentile values of a field for a list of records (similar to percentile, but returns an array of values instead of a single one).
`percentiles(expression [, weight ,] percentile, …)`
  `expression` (Boolean|Double|Duration|Long|Timestamp) — The expression from which to compute a percentile.
  `weight:?` (Double|Long) — The weight of the corresponding expression (e.g. its sampling ratio).  [default:1, min:0]
  `percentile*` (Double|Long) — The percentile to compute, between 0 and 100.  [min:0]
  → Array

## `stddev`
Calculates the standard deviation of a field for a list of records.
`stddev(expression)`
  `expression` (Double|Long) — The expression from which to compute standard deviation.
  → Double

## `sum`
Calculates the sum of a field for a list of records.
`sum(expression)`
  `expression` (Double|Duration|Long) — The expression from which to compute the sum.
  → Double|Duration

## `takeAny`
Returns a value of a field for a list of records. Any record can be given despite records are ordered or not.
`takeAny(expression)`
  `expression` (any) — The expression from which to take any element.
  → any

## `takeFirst`
Returns the first value of a field for a list of records in the current order.
`takeFirst(expression)`
  `expression` (any) — The expression from which to take the first element.
  → any

## `takeLast`
Returns the last value of a field for a list of records in the current order.
`takeLast(expression)`
  `expression` (any) — The expression from which to take the last element.
  → any

## `takeMax`
Returns the maximum value of a field for a list of records. The records will be ordered based on the field data type and the field value and the maximum will be taken.
`takeMax(expression)`
  `expression` (any) — The expression from which to take the maximum element.
  → any

## `takeMin`
Returns the minimum value of a field for a list of records. The records will be ordered based on the field data type and the field value and the minimum will be taken.
`takeMin(expression)`
  `expression` (any) — The expression from which to take the minimum element.
  → any

## `variance`
Calculates the variance of a field for a list of records.
`variance(expression)`
  `expression` (Double|Long) — The expression from which to compute variance.
  → Double
