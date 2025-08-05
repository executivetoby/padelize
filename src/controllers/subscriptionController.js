import { get } from 'mongoose';
import {
  cancelSubscriptionService,
  changePlanService,
  createCheckoutSessionService,
  createFreeSubscriptionService,
  getCurrentSubscriptionService,
  getPaymentHistoryService,
  getSubscriptionHistoryService,
  handleSubscriptionSuccessService,
} from '../services/subscriptionService.js';
import catchAsync from '../utils/catchAsync.js';

export const createCheckoutSession = catchAsync(async (req, res, next) => {
  createCheckoutSessionService(req, res, next);
});

export const handleSubscriptionSuccess = catchAsync(async (req, res, next) => {
  handleSubscriptionSuccessService(req, res, next);
});

export const cancelSubscription = catchAsync(async (req, res, next) => {
  cancelSubscriptionService(req, res, next);
});

export const getCurrentSubscription = catchAsync(async (req, res, next) => {
  getCurrentSubscriptionService(req, res, next);
});

export const changePlan = catchAsync(async (req, res, next) => {
  changePlanService(req, res, next);
});

export const getSubscriptionHistory = catchAsync(async (req, res, next) => {
  getSubscriptionHistoryService(req, res, next);
});

export const getPaymentHistory = catchAsync(async (req, res, next) => {
  getPaymentHistoryService(req, res, next);
});

export const createFreeSubscription = catchAsync(async (req, res, next) => {
  createFreeSubscriptionService(req, res, next);
});
