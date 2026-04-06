# DQL Functions — Array

Param notation: `name` = required positional · `name:` = required named · suffix `*` = variadic · suffix `?` = optional · types listed as `|`-separated names or `any` (all scalar+collection types)

## Table of Contents

[`arrayAvg`](#arrayavg) · [`arrayConcat`](#arrayconcat) · [`arrayCumulativeSum`](#arraycumulativesum) · [`arrayDelta`](#arraydelta) · [`arrayDiff`](#arraydiff) · [`arrayDistinct`](#arraydistinct) · [`arrayFirst`](#arrayfirst) · [`arrayFlatten`](#arrayflatten) · [`arrayIndexOf`](#arrayindexof) · [`arrayLast`](#arraylast) · [`arrayLastIndexOf`](#arraylastindexof) · [`arrayMax`](#arraymax) · [`arrayMedian`](#arraymedian) · [`arrayMin`](#arraymin) · [`arrayMovingAvg`](#arraymovingavg) · [`arrayMovingMax`](#arraymovingmax) · [`arrayMovingMin`](#arraymovingmin) · [`arrayMovingSum`](#arraymovingsum) · [`arrayPercentile`](#arraypercentile) · [`arrayRemoveNulls`](#arrayremovenulls) · [`arrayReverse`](#arrayreverse) · [`arraySize`](#arraysize) · [`arraySlice`](#arrayslice) · [`arraySort`](#arraysort) · [`arraySum`](#arraysum) · [`arrayToString`](#arraytostring) · [`vectorCosineDistance`](#vectorcosinedistance) · [`vectorInnerProductDistance`](#vectorinnerproductdistance) · [`vectorL1Distance`](#vectorl1distance) · [`vectorL2Distance`](#vectorl2distance)

_array function_

## `arrayAvg`
Returns the average of an array. Values that are not numeric are ignored. 0 if there is no matching element.
`arrayAvg(array)`
  `array` (Array) — an array expression
  → Double

## `arrayConcat`
Concatenates multiple arrays into a single array.
`arrayConcat(array, …)`
  `array*` (Array) — Array expression that should be combined with others.
  → Array

## `arrayCumulativeSum`
Returns the sums of elements from the input array and all elements with a lower index.
`arrayCumulativeSum(array)`
  `array` (Array) — an array expression
  → Array

## `arrayDelta`
Returns array of delta of array elements
`arrayDelta(array)`
  `array` (Array) — an array expression
  → Array

## `arrayDiff`
Returns array of same length where result[i] == input[i] - input[i-1].
`arrayDiff(array)`
  `array` (Array) — an array expression
  → Array

## `arrayDistinct`
Returns the array without duplicates.
`arrayDistinct(array)`
  `array` (Array) — an array expression
  → Array

## `arrayFirst`
Returns the first non-null element of an array (use myArray[0] to get the first nullable element).
`arrayFirst(array)`
  `array` (Array) — an array expression
  → any

## `arrayFlatten`
Returns flattened array
`arrayFlatten(array)`
  `array` (Array) — an array expression
  → Array

## `arrayIndexOf`
Returns the index of the first array element with the given value.
`arrayIndexOf(array, value)`
  `array` (Array) — The array expression in which the value is searched for.
  `value` (any) — The primitive value to search for in the expression.
  → Long

## `arrayLast`
Returns the last non-null element of an array (use myArray[-1] to get the last nullable element).
`arrayLast(array)`
  `array` (Array) — an array expression
  → any

## `arrayLastIndexOf`
Returns the index of the last array element with the given value.
`arrayLastIndexOf(array, value)`
  `array` (Array) — The array expression in which the value is searched for.
  `value` (any) — The primitive value to search for in the expression.
  → Long

## `arrayMax`
Returns the maximum (biggest) number of an array. Values that are not numeric are ignored. `null` if there is no matching element.
`arrayMax(array)`
  `array` (Array) — an array expression
  → any

## `arrayMedian`
Returns the median of the members of an array.
`arrayMedian(expression)`
  `expression` (Array) — The array from which to compute the median.
  → Boolean|Double|Duration|Timestamp

## `arrayMin`
Returns the minimum (smallest) number of an array. Values that are not numeric are ignored. `null` if there is no matching element.
`arrayMin(array)`
  `array` (Array) — an array expression
  → any

## `arrayMovingAvg`
Returns the averages of elements from the input array calculated according to the moving window size.
`arrayMovingAvg(array, windowSize)`
  `array` (Array) — The array of numeric values.
  `windowSize` (Long) — The size of moving window.  [min:0]
  → Array

## `arrayMovingMax`
Returns the maximums of elements from the input array calculated according to the moving window size.
`arrayMovingMax(array, windowSize)`
  `array` (Array) — The array of numeric values.
  `windowSize` (Long) — The size of moving window.  [min:0]
  → Array

## `arrayMovingMin`
Returns the minimums of elements from the input array calculated according to the moving window size.
`arrayMovingMin(array, windowSize)`
  `array` (Array) — The array of numeric values.
  `windowSize` (Long) — The size of moving window.  [min:0]
  → Array

## `arrayMovingSum`
Returns the sums of elements from the input array calculated according to the moving window size.
`arrayMovingSum(array, windowSize)`
  `array` (Array) — The array of numeric values.
  `windowSize` (Long) — The size of moving window.  [min:0]
  → Array

## `arrayPercentile`
Returns a percentile of the members of an array.
`arrayPercentile(expression, percentile)`
  `expression` (Array) — The array from which to compute a percentile.
  `percentile` (Double|Long) — The percentile to compute, between 0 and 100.  [min:0]
  → Boolean|Double|Duration|Timestamp

## `arrayRemoveNulls`
Returns the array where NULL elements are removed.
`arrayRemoveNulls(array)`
  `array` (Array) — an array expression
  → Array

## `arrayReverse`
Returns the array with elements in reversed order.
`arrayReverse(array)`
  `array` (Array) — an array expression
  → Array

## `arraySize`
Returns the size of an array.
`arraySize(array)`
  `array` (Array) — an array expression
  → Long

## `arraySlice`
Returns a slice of an array.
`arraySlice(array [, from] [, to])`
  `array` (Array) — an array expression
  `from:?` (Long) — Index of first element to include in the resulting array, inclusive, relative to start of `array` if positive, relative to end if negative. Clamped at array bounds.  [default:0]
  `to:?` (Long) — Index of last element to include in the resulting array, exclusive, relative to start of `array` if positive, relative to end if negative. Clamped at array bounds.  [default:9223372036854775807]
  → Array

## `arraySort`
Returns the array with members sorted in ascending order.
`arraySort(array [, direction])`
  `array` (Array) — an array expression
  `direction:?` (—) — direction  [default:"ascending"]
  → Array

## `arraySum`
Returns the sum of an array. Values that are not numeric are ignored. 0 if there is no matching element.
`arraySum(array)`
  `array` (Array) — an array expression
  → Double

## `arrayToString`
Converts an array to a string.
`arrayToString(array [, delimiter])`
  `array` (Array) — Array expression that should be converted to a string.
  `delimiter:?` (String) — A constant string expression that is added between the concatenated array elements.  [default:""]
  → String

## `vectorCosineDistance`
Calculates the cosine distance between two arrays.
`vectorCosineDistance(firstExpression, secondExpression)`
  `firstExpression` (Array) — An array of numeric values.
  `secondExpression` (Array) — An array of numeric values.
  → Double

## `vectorInnerProductDistance`
Calculates the inner product distance between two arrays.
`vectorInnerProductDistance(firstExpression, secondExpression)`
  `firstExpression` (Array) — An array of numeric values.
  `secondExpression` (Array) — An array of numeric values.
  → Double

## `vectorL1Distance`
Calculates the L1 distance between two arrays.
`vectorL1Distance(firstExpression, secondExpression)`
  `firstExpression` (Array) — An array of numeric values.
  `secondExpression` (Array) — An array of numeric values.
  → Double

## `vectorL2Distance`
Calculates the L2 distance between two arrays.
`vectorL2Distance(firstExpression, secondExpression)`
  `firstExpression` (Array) — An array of numeric values.
  `secondExpression` (Array) — An array of numeric values.
  → Double
