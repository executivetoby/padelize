# Analysis Data Serialization Fix

## Problem
The analysis data returned from endpoints was displaying Mongoose document internal properties (like `__parentArray`, `$__parent`, `$__`, `_doc`, etc.) instead of clean JSON objects. Additionally, users were receiving shot data even when their subscription plan didn't include shot classification features.

## Root Cause
1. **Mongoose Document Serialization**: Analysis objects retrieved via `findOne(Analysis, ...)` were Mongoose documents with internal properties that weren't being properly serialized to clean JSON.

2. **Missing Subscription Filtering**: Some analysis endpoints (`getAnalysisResultsService` in both analysisService.js and analysisService1.js) were returning raw Python API results without applying subscription-based filtering.

3. **Incomplete Feature Filtering**: The `filterAnalysisResultsBySubscription` function wasn't properly handling the player analytics structure and shot data exclusion.

## Solution

### 1. Fixed Mongoose Document Serialization
**File**: `src/services/matchService.js`

```javascript
// Convert Mongoose document to plain object before filtering
const analysisObj = analysis.toObject ? analysis.toObject() : analysis;
analysis = filterAnalysisResultsBySubscription(analysisObj, req.user);
```

### 2. Enhanced Subscription Filtering
**File**: `src/utils/subscriptionUtils.js`

- Completely rewrote `filterAnalysisResultsBySubscription` to properly handle player analytics structure
- Added proper feature-based filtering for shot data
- Ensured clean object structure without Mongoose internals
- Only includes shot data if user has `basicShotClassification` feature

### 3. Fixed Analysis Result Endpoints
**Files**: 
- `src/services/analysisService1.js`
- `src/services/analysisService.js`

Both `getAnalysisResultsService` functions now apply subscription filtering:

```javascript
// Apply subscription-based filtering to results
const filteredResults = filterAnalysisResultsBySubscription(results, req.user);
```

## Plan Features

### Free Plan
- **Basic shot classification**: ✅ Gets shot data
- **Movement analytics**: ✅ Speed, distance, calories
- **Shot events/highlights**: ✅ If available

### Pro Plan  
- **All free features**: ✅
- **Full shot breakdown**: ✅ Includes all shot types
- **Movement heatmaps**: ✅ If available
- **Advanced metrics**: ✅ If available

## Result
- Analysis responses now return clean JSON objects without Mongoose internals
- Shot data is properly filtered based on subscription features
- Users without shot classification features won't see shot-related data
- Consistent filtering across all analysis endpoints

## Testing
Run any analysis endpoint and verify:
1. No `__parentArray`, `$__parent`, `$__`, `_doc` properties in response
2. Shot data only appears for users with appropriate subscription features
3. Clean, properly structured JSON responses
