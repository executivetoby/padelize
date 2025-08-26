# Match Service Subscription Integration

## Overview
Since you're using the `matchService` to handle video analysis instead of `analysisRoutes`, I've integrated the subscription middleware directly into your match-related services and routes.

## What I've Implemented

### 1. Updated Match Routes (`src/routes/matchRoutes.js`)
```javascript
import {
  addSubscriptionInfo,
  setPriority
} from '../middleware/subscriptionMiddleware.js';

// Applied to all routes:
router.use(addSubscriptionInfo); // Adds subscription info to responses

// Applied to video upload:
router.post('/upload_video', 
  setPriority,        // Sets processing priority based on plan
  videoUpload, 
  uploadVideo
);

// New endpoint to check quota:
router.get('/analysis-quota', checkAnalysisQuota);
```

### 2. Updated Match Service (`src/services/matchService.js`)

#### Added Subscription Utilities Import:
```javascript
import { 
  checkUserAnalysisQuota, 
  filterAnalysisResultsBySubscription,
  getProcessingMessage 
} from '../utils/subscriptionUtils.js';
```

#### Enhanced `uploadVideoService`:
- **Quota Check**: Checks if user can perform analysis before upload
- **Priority Processing**: Sets processing priority based on subscription 
- **Response Enhancement**: Includes remaining analyses and processing time

```javascript
// Check subscription quota before proceeding
const quotaCheck = await checkUserAnalysisQuota(req.user);

if (!quotaCheck.canAnalyze) {
  return next(new AppError(
    `You have reached your weekly limit of ${quotaCheck.totalAllowed} match analysis. Upgrade to Pro for more analyses.`, 
    403
  ));
}

// Auto-trigger video analysis with subscription priority
await startVideoAnalysis(match, req.user._id, req.body, quotaCheck.priority);

// Enhanced response
res.json({
  status: 'success',
  message: 'Uploaded successfully and analysis started',
  data: {
    match,
    remainingAnalyses: quotaCheck.remainingAnalyses,
    processingMessage: getProcessingMessage(quotaCheck.priority)
  }
});
```

#### Enhanced `getMatchService`:
- **Filtered Results**: Analysis results are filtered based on subscription features
- **Smart Auto-Analysis**: Only auto-starts analysis if quota allows

```javascript
// Check quota before auto-starting analysis
const quotaCheck = await checkUserAnalysisQuota(req.user);

if (quotaCheck.canAnalyze) {
  await startVideoAnalysis(match, req.user._id, req.body, quotaCheck.priority);
} else {
  console.log('Auto-analysis skipped: quota exceeded');
}

// Filter analysis results based on subscription
if (analysis) {
  analysis = filterAnalysisResultsBySubscription(analysis, req.user);
}
```

#### Enhanced `startVideoAnalysis`:
- **Priority Processing**: Accepts priority parameter for processing queue
```javascript
const startVideoAnalysis = async (match, userId, requestBody, priority = 'standard') => {
  const analysisResult = await VideoAnalysisService.analyzeVideo({
    match_id: match._id.toString(),
    video_link: match.video,
    player_color: generateColorString(match),
    generate_highlights: true,
    priority: priority // Pass priority to analysis service
  });
}
```

#### New `checkAnalysisQuotaService`:
```javascript
export const checkAnalysisQuotaService = catchAsync(async (req, res, next) => {
  const quotaCheck = await checkUserAnalysisQuota(req.user);
  
  res.status(200).json({
    status: 'success',
    data: {
      canAnalyze: quotaCheck.canAnalyze,
      remainingAnalyses: quotaCheck.remainingAnalyses,
      totalAllowed: quotaCheck.totalAllowed,
      unlimited: quotaCheck.remainingAnalyses === -1,
      plan: req.user.subscription?.plan || 'free',
      priority: quotaCheck.priority,
      processingMessage: getProcessingMessage(quotaCheck.priority)
    }
  });
});
```

### 3. Created Subscription Utils (`src/utils/subscriptionUtils.js`)

#### `checkUserAnalysisQuota(user)`:
- Checks weekly analysis limits
- Returns quota status and remaining analyses
- Handles unlimited plans (MAX)

#### `filterAnalysisResultsBySubscription(analysis, user)`:
- Filters analysis data based on plan features
- **FREE**: Basic shots (forehand/backhand only), basic stats
- **PRO**: Full shot breakdown, heatmaps, speed metrics

#### `getProcessingMessage(priority)`:
- Returns user-friendly processing time estimates
- **Standard**: 2-4 hours (FREE)
- **Fast**: Within 1 hour (PRO)
- **Fastest**: 15-30 minutes (MAX)

## API Endpoints

### Upload Video with Subscription Check
```
POST /api/v1/matches/upload_video
```
**Response includes:**
```json
{
  "status": "success",
  "data": {
    "match": {...},
    "remainingAnalyses": 2,
    "processingMessage": "Your match is being processed with fast priority (PRO plan) - expect results within 1 hour"
  },
  "subscription": {
    "plan": "pro_monthly",
    "features": {...},
    "status": "active"
  }
}
```

### Check Analysis Quota
```
GET /api/v1/matches/analysis-quota
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "canAnalyze": true,
    "remainingAnalyses": 2,
    "totalAllowed": 3,
    "unlimited": false,
    "plan": "pro_monthly",
    "priority": "fast",
    "processingMessage": "Your match is being processed with fast priority..."
  }
}
```

### Get Match with Filtered Analysis
```
GET /api/v1/matches/:matchId
```
**Analysis data filtered by subscription:**
- **FREE users**: Only see basic shot classification and basic stats
- **PRO users**: See full shot breakdown, heatmaps, speed metrics

## Frontend Integration Examples

### Check Quota Before Upload
```javascript
// Check if user can upload
const quotaResponse = await fetch('/api/v1/matches/analysis-quota');
const quotaData = await quotaResponse.json();

if (!quotaData.data.canAnalyze) {
  showUpgradePrompt(`You've reached your limit of ${quotaData.data.totalAllowed} analyses this week`);
  return;
}

// Proceed with upload
const uploadResponse = await fetch('/api/v1/matches/upload_video', {
  method: 'POST',
  body: formData
});
```

### Show Processing Priority
```javascript
// After upload
const response = await uploadVideo(videoData);
showMessage(response.data.processingMessage);
// "Your match is being processed with fast priority (PRO plan) - expect results within 1 hour"
```

### Handle Subscription Features in UI
```javascript
// In analysis display component
if (subscription.features.fullShotBreakdown) {
  showAdvancedShots(analysis.advancedShots);
}

if (subscription.features.movementHeatmaps) {
  showHeatmap(analysis.heatmap);
}

if (subscription.features.averageSpeed) {
  showSpeedMetrics(analysis.speedMetrics);
}
```

## Error Handling

### Quota Exceeded
```json
{
  "status": "fail",
  "message": "You have reached your weekly limit of 1 match analysis. Upgrade to Pro for more analyses."
}
```

### Feature Not Available
Analysis results will simply exclude premium features for free users, ensuring a graceful degradation rather than errors.

## Testing

### Test Quota Limits
1. Create a user with free subscription
2. Upload video - should work for first analysis
3. Try to upload second video - should fail with quota message

### Test Feature Filtering
1. Create analysis with all features
2. Fetch as FREE user - should only see basic features
3. Fetch as PRO user - should see all features

### Test Processing Priority
1. Upload as FREE user - should show "2-4 hours" message
2. Upload as PRO user - should show "within 1 hour" message

This implementation ensures that your existing match workflow remains intact while adding subscription-based restrictions and enhancements seamlessly.
