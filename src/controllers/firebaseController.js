import { createOne } from '../factory/repo.js';
import FirebaseToken from '../models/FirebaseToken.js';
import catchAsync from '../utils/catchAsync.js';

export const saveToken = catchAsync(async (req, res, next) => {
  const { _id } = req.user;

  const token = await createOne(FirebaseToken, {
    user: _id,
    regid:
      'etOTltrIRRt5xaQwMhtPT8:APA91bGO9Kkq2FzK3lZkHU-obccb46VV-vh2t8YW6XSri4lzehoISDoikrl_g-mVdcwJBlEQ2sRgAQikvH1ZRBm-22GSeUlg2_a7Pqd_tTMrZJQVax8NyYk',
  });

  res.status(201).json({
    status: 'success',
    data: {
      token,
    },
  });
});
