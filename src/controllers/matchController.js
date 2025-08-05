import {
  createMatchServiceService,
  deleteMatchService,
  getAllMatchesService,
  getMatchService,
  getUserProfileService,
  updateMatchService,
  uploadVideoService,
} from '../services/matchService.js';
import catchAsync from '../utils/catchAsync.js';

export const createMatch = catchAsync(async (req, res, next) => {
  createMatchServiceService(req, res, next);
});

export const getMatch = catchAsync(async (req, res, next) => {
  getMatchService(req, res, next);
});

export const getAllMatches = catchAsync(async (req, res, next) => {
  getAllMatchesService(req, res, next);
});

export const updateMatch = catchAsync(async (req, res, next) => {
  updateMatchService(req, res, next);
});

export const deleteMatch = catchAsync(async (req, res, next) => {
  deleteMatchService(req, res, next);
});

export const uploadVideo = catchAsync(async (req, res, next) => {
  uploadVideoService(req, res, next);
});

export const getUserProfile = catchAsync(async (req, res, next) => {
  getUserProfileService(req, res, next);
});
