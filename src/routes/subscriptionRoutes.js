import { Router } from 'express';
import { protect } from '../controllers/authController.js';
import {
  cancelSubscription,
  changePlan,
  createCheckoutSession,
  createFreeSubscription,
  getCurrentSubscription,
  getPaymentHistory,
  getSubscriptionHistory,
  handleSubscriptionSuccess,
} from '../controllers/subscriptionController.js';
import {
  getAllPackages,
  getIndividualSubscriptionHistory,
  listProducts,
} from '../services/subscriptionService.js';

const router = Router();

// router.get('/products', listProducts);
router.get('/success', (req, res) => {
  res.send('Subscription success');
});
router.post('/success', handleSubscriptionSuccess);
router.get('/products', getAllPackages);

router.use(protect);

router.post('/create_free_subscription', createFreeSubscription);
router.post('/create_checkout_session', createCheckoutSession);
router.post('/cancel', cancelSubscription);
router.post('/change_plan', changePlan);
router.get('/current_subscription', getCurrentSubscription);
router.get('/payment_history', getPaymentHistory);
router.get('/subscription_history', getSubscriptionHistory);
router.get('/:subId', getIndividualSubscriptionHistory);

export default router;
