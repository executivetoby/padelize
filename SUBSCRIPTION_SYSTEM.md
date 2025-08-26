# Subscription Management System

This system implements subscription-based feature access for the Padelize tennis app with FREE and PRO plan tiers.

## Features by Plan

### 🆓 FREE Plan
- 1 AI match analysis per week
- Shot success percentage
- Basic shot classification (forehand/backhand)
- Distance covered & calories burned
- Access to community feed
- Appear on leaderboard
- Standard processing (2-4 hours)

### 💎 PRO Plan (€9.99/month)
- Up to 3 match analyses per week
- Full shot breakdown (including smash & volley)
- Movement heatmaps
- Average speed metrics
- Faster processing (within 1 hour)
- Early feature access

### MAX Plan (Future)
- Unlimited analyses
- Priority processing (15-30 minutes)
- Advanced analytics
- Custom reports

## Implementation

### 1. Subscription Middleware

#### Import the middleware:
```javascript
import {
  checkMatchAnalysisLimit,
  requireFeature,
  requireFullShotBreakdown,
  requireMovementHeatmaps,
  requireAverageSpeed,
  requireEarlyFeatureAccess,
  addSubscriptionInfo,
  setPriority
} from '../middleware/subscriptionMiddleware.js';
```

#### Usage examples:

**Check weekly analysis limit:**
```javascript
router.post('/analyze-video', 
  protect,
  checkMatchAnalysisLimit,  // Blocks if user exceeded weekly limit
  setPriority,              // Sets processing priority based on plan
  videoUpload, 
  analyzeVideoService
);
```

**Require specific features:**
```javascript
// PRO+ only: Full shot breakdown
router.get('/advanced-shots/:id', 
  protect,
  requireFullShotBreakdown,
  getAdvancedShotsController
);

// PRO+ only: Movement heatmaps
router.get('/heatmap/:id',
  protect, 
  requireMovementHeatmaps,
  getHeatmapController
);

// PRO+ only: Speed metrics
router.get('/speed/:id',
  protect,
  requireAverageSpeed, 
  getSpeedMetricsController
);
```

**Add subscription info to all responses:**
```javascript
router.use(protect);
router.use(addSubscriptionInfo); // Adds subscription data to all responses
```

### 2. Custom Feature Checks

```javascript
// Custom feature requirement
router.get('/beta-features',
  protect,
  requireFeature('earlyFeatureAccess'),
  getBetaFeaturesController
);
```

### 3. Conditional Data Based on Subscription

```javascript
import { getUserPlanFeatures } from '../middleware/subscriptionMiddleware.js';

export const getAnalysisData = catchAsync(async (req, res) => {
  const features = getUserPlanFeatures(req.user);
  
  const response = {
    basicStats: analysis.basicStats // Always included
  };
  
  // Add premium features conditionally
  if (features.fullShotBreakdown) {
    response.advancedShots = analysis.advancedShots;
  }
  
  if (features.movementHeatmaps) {
    response.heatmap = analysis.heatmap;
  }
  
  res.json({ status: 'success', data: response });
});
```

### 4. Processing Priority

The middleware automatically sets `req.processingPriority` based on the user's plan:
- **FREE**: 'standard' (2-4 hours)
- **PRO**: 'fast' (within 1 hour)  
- **MAX**: 'fastest' (15-30 minutes)

Use this in your processing logic:
```javascript
export const processVideo = catchAsync(async (req, res) => {
  const priority = req.processingPriority;
  
  // Add to appropriate queue based on priority
  await addToQueue(`analysis-${priority}`, {
    videoUrl: req.file.location,
    userId: req.user._id,
    priority: priority
  });
});
```

## Automatic Subscription Management

### Cron Jobs
The system automatically:

1. **Daily at 2:00 AM** - Send expiry warnings (3 days before expiry)
2. **Daily at 3:00 AM** - Downgrade expired subscriptions to free
3. **Daily at 4:00 AM** - Handle failed payments (cancel after 7 days)

### Stripe Webhooks
Handles all Stripe events:
- `checkout.session.completed` - Create/update subscription
- `customer.subscription.updated` - Update subscription details
- `invoice.payment_succeeded` - Confirm payment
- `invoice.payment_failed` - Handle failed payments
- `customer.subscription.deleted` - Cancel subscription

## Error Messages

The middleware provides user-friendly error messages:

- **Analysis limit reached**: "You have reached your weekly limit of 1 match analysis. Upgrade to Pro for more analyses."
- **Feature not available**: "This feature requires a subscription upgrade. Your current plan does not include movement heatmaps."
- **Authentication required**: "User not authenticated"

## API Response Format

All responses include subscription information when `addSubscriptionInfo` middleware is used:

```json
{
  "status": "success",
  "data": {
    "analysis": { ... }
  },
  "subscription": {
    "plan": "pro_monthly",
    "features": {
      "matchAnalysesPerWeek": 3,
      "fullShotBreakdown": true,
      "movementHeatmaps": true,
      "averageSpeed": true,
      "processingSpeed": "fast"
    },
    "status": "active"
  }
}
```

## Manual Testing

For testing, you can manually trigger cron jobs:

```javascript
import { 
  manuallyCheckExpiring,
  manuallyProcessExpired,
  manuallyProcessFailedPayments 
} from '../services/subscriptionCronService.js';

// Test expiry warnings
await manuallyCheckExpiring();

// Test expired subscription processing  
await manuallyProcessExpired();

// Test failed payment handling
await manuallyProcessFailedPayments();
```

## Usage in Your Routes

1. **Always use `protect` first** for authentication
2. **Add `addSubscriptionInfo`** to include subscription data in responses
3. **Use specific middleware** for feature requirements
4. **Use `checkMatchAnalysisLimit`** for analysis endpoints
5. **Use `setPriority`** for processing-heavy operations

Example complete route setup:
```javascript
import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  checkMatchAnalysisLimit,
  requireFullShotBreakdown,
  addSubscriptionInfo,
  setPriority
} from '../middleware/subscriptionMiddleware.js';

const router = Router();

// Authentication & subscription info for all routes
router.use(protect);
router.use(addSubscriptionInfo);

// Analysis with limits and priority
router.post('/analyze', 
  checkMatchAnalysisLimit,
  setPriority,
  videoUpload,
  analyzeVideoController
);

// Premium feature
router.get('/advanced/:id',
  requireFullShotBreakdown,
  getAdvancedAnalysisController  
);

export default router;
```

This system ensures that users only access features they've paid for while providing clear upgrade paths and maintaining data security.
