import { createOne, deleteOne, findOne, getAll } from '../factory/repo.js';
import { findOneAndUpdate } from '../factory/userRepo.js';
import Match from '../models/Match.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import fs from 'fs';
import { uploadLargeFile } from './s3UploadService.js';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import FirebaseService from './firebaseService.js'; // Import Firebase service
import { VideoAnalysisService } from './analysisService.js';
import AnalysisStatus from '../models/AnalysisStatus.js';
import Analysis from '../models/Analysis.js';

export const createMatchServiceService = catchAsync(async (req, res, next) => {
  const match = await createOne(Match, req.body);

  // Send notification to user about match creation
  await FirebaseService.sendNotification(
    req.user._id,
    'Match Created',
    'Your match has been created successfully!',
    { matchId: match._id.toString(), type: 'match_created' }
  );

  res.status(201).json({
    status: 'success',
    data: {
      match,
    },
  });
});

export const getMatchService = catchAsync(async (req, res, next) => {
  const [match, analysisStatus] = await Promise.all([
    findOne(
      Match,
      {
        _id: req.params.matchId,
        // creator: req.user._id,
      },
      [{ path: 'analysisStatusId' }]
    ),
    findOne(AnalysisStatus, { match_id: req.params.matchId }),
  ]);

  // console.log({ match });

  if (!match)
    return next(
      new AppError(
        'No match found or you are not authorized to view this match',
        404
      )
    );

  if (!match.analysisStatus) {
    try {
      await startVideoAnalysis(match, req.user._id, req.body);
    } catch (analysisError) {
      console.error('Auto-analysis failed:', analysisError);
      // Don't fail the upload if analysis fails
      await FirebaseService.sendNotification(
        req.user._id,
        'Analysis Failed to Start',
        'Auto-analysis failed to start.',
        {
          matchId: match._id.toString(),
          type: 'auto_analysis_failed',
          error: analysisError.message,
        }
      );
    }
  }

  if (match.analysisStatus === 'failed') {
    try {
      await VideoAnalysisService.restartAnalysis(match._id);

      match.analysisStatus = 'restarting';
      analysisStatus.status = 'restarting';

      await Promise.all([match.save(), analysisStatus.save()]);
    } catch (analysisError) {
      await FirebaseService.sendNotification(
        req.user._id,
        'Analysis Failed to restart',
        'Video uploaded successfully, but auto-analysis failed. You can try again manually.',
        {
          matchId: match._id.toString(),
          type: 'auto_analysis_failed',
          error: analysisError.message,
        }
      );
      console.error('Error restarting analysis:', analysisError);
    }
  }

  const analysis = await findOne(Analysis, { match_id: match._id });

  console.log(req.params.matchId, req.user._id, match);

  res.status(200).json({
    status: 'success',
    message:
      match.analysisStatus === 'failed'
        ? 'Match analysis failed, restarting now...'
        : match.analysisStatus === 'processing' ||
          match.analysisStatus === 'pending'
        ? 'Match analysis is still processing...'
        : 'Match analysis completed successfully.',
    data: {
      match,
      analysis,
    },
  });
});

export const getAllMatchesService = catchAsync(async (req, res, next) => {
  const { _id: userId } = req.user;

  req.query.creator = userId;

  const matches = await getAll(Match, req.query);

  res.status(200).json({
    status: 'success',
    data: {
      matches,
    },
  });
});

export const updateMatchService = catchAsync(async (req, res, next) => {
  const match = await findOneAndUpdate(
    Match,
    { _id: req.params.matchId, creator: req.user._id },
    req.body
  );

  if (!match)
    return next(
      new AppError(
        'No match found or you are not authorized to update this match',
        404
      )
    );

  // Send notification about match update
  await FirebaseService.sendNotification(
    req.user._id,
    'Match Updated',
    'Your match has been updated successfully!',
    { matchId: match._id.toString(), type: 'match_updated' }
  );

  res.status(200).json({
    status: 'success',
    data: {
      match,
    },
  });
});

export const deleteMatchService = catchAsync(async (req, res, next) => {
  const match = await deleteOne(Match, {
    _id: req.params.matchId,
    creator: req.user._id,
  });

  if (!match)
    return next(
      new AppError(
        'No match found or you are not authorized to delete this match',
        404
      )
    );

  // Send notification about match deletion
  await FirebaseService.sendNotification(
    req.user._id,
    'Match Deleted',
    'Your match has been deleted successfully!',
    { type: 'match_deleted' }
  );

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

/**
 * Handles the upload of a video file for a match.
 */
export const uploadVideoService = catchAsync(async (req, res, next) => {
  try {
    const { path: tempPath, originalname } = req.file;

    const match = await findOne(Match, {
      _id: req.body.matchId,
      creator: req.user._id,
    });

    if (!match) return next(new AppError('Match not found', 404));

    if (match.video)
      return next(
        new AppError('Match already has a video attached to it', 400)
      );

    // Core Upload Execution
    const result = await uploadLargeFile(tempPath, originalname);

    // Cleanup temporary file
    fs.unlinkSync(tempPath);

    match.video = result.Location;
    await match.save();

    // Send notification about video upload
    await FirebaseService.sendNotification(
      req.user._id,
      'Video Uploaded',
      'Your match video has been uploaded successfully!',
      {
        matchId: match._id.toString(),
        type: 'video_uploaded',
        videoUrl: result.Location,
      }
    );

    // Auto-trigger video analysis after successful upload
    try {
      const analysisResponse = await startVideoAnalysis(
        match,
        req.user._id,
        req.body
      );
    } catch (analysisError) {
      console.error('Auto-analysis failed:', analysisError);
      // Don't fail the upload if analysis fails
      await FirebaseService.sendNotification(
        req.user._id,
        'Analysis Failed to Start',
        'Video uploaded successfully, but auto-analysis failed. You can try again manually.',
        {
          matchId: match._id.toString(),
          type: 'auto_analysis_failed',
          error: analysisError.message,
        }
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Uploaded successfully and analysis started',
      data: {
        match,
      },
    });
  } catch (error) {
    console.error('Upload failed:', error);

    // Send notification about upload failure
    await FirebaseService.sendNotification(
      req.user._id,
      'Upload Failed',
      'There was an error uploading your video. Please try again.',
      { type: 'video_upload_failed' }
    );

    res.status(500).json({ error: 'Upload failed' });
  }
});

// Extract analysis logic into a separate function
const startVideoAnalysis = async (match, userId, requestBody) => {
  // const options = {
  //   confidence: parseFloat(requestBody.confidence) || 0.5,
  //   skip_frames: parseInt(requestBody.skip_frames) || 5,
  //   court_detection: requestBody.court_detection === 'true',
  // };

  // Send notification that analysis is starting
  await FirebaseService.sendNotification(
    userId,
    'Analysis Starting',
    'Your video analysis is now starting...',
    {
      matchId: match._id.toString(),
      type: 'analysis_starting',
      status: 'processing',
    }
  );

  console.log('Player color:', generateColorString(match));

  const analysisResult = await VideoAnalysisService.analyzeVideo({
    match_id: match._id.toString(),
    video_link: match.video,
    player_color: generateColorString(match),
    generate_highlights: true,
  });

  if (!analysisResult) {
    throw new Error('Analysis failed to start');
  }

  const analysisStatus = await createOne(AnalysisStatus, {
    match_id: match._id,
    status: analysisResult.status,
    message: analysisResult.message,
  });

  // Update match with analysis info
  match.analysisStatus = analysisResult.status;
  match.analysisStatusId = analysisStatus._id;
  await match.save();

  await match.populate('analysisStatusId');

  // Send notification that analysis has started successfully
  await FirebaseService.sendNotification(
    userId,
    'Analysis Started',
    'Your video analysis has started successfully! You will be notified when it completes.',
    {
      matchId: match._id.toString(),
      analysisId: analysisResult.analysis_id,
      type: 'analysis_started',
      status: 'processing',
    }
  );

  return analysisResult;
};

// export const uploadVideoService = catchAsync(async (req, res, next) => {
//   try {
//     const { path: tempPath, originalname } = req.file;

//     const match = await findOne(Match, {
//       _id: req.body.matchId,
//       creator: req.user._id,
//     });

//     if (!match) return next(new AppError('Match not found', 404));

//     if (match.video)
//       return next(
//         new AppError('Match already has a video attached to it', 400)
//       );

//     // Core Upload Execution
//     const result = await uploadLargeFile(tempPath, originalname);

//     // Cleanup temporary file
//     fs.unlinkSync(tempPath);

//     match.video = result.Location;
//     await match.save();

//     // Send notification about video upload
//     await FirebaseService.sendNotification(
//       req.user._id,
//       'Video Uploaded',
//       'Your match video has been uploaded successfully!',
//       {
//         matchId: match._id.toString(),
//         type: 'video_uploaded',
//         videoUrl: result.Location,
//       }
//     );

//     res.status(200).json({
//       status: 'success',
//       message: 'Uploaded successfully',
//       data: {
//         match,
//       },
//     });
//   } catch (error) {
//     console.error('Upload failed:', error);

//     // Send notification about upload failure
//     await FirebaseService.sendNotification(
//       req.user._id,
//       'Upload Failed',
//       'There was an error uploading your video. Please try again.',
//       { type: 'video_upload_failed' }
//     );

//     res.status(500).json({ error: 'Upload failed' });
//   }
// });

export const getUserProfileService = catchAsync(async (req, res, next) => {
  const userId = req.query.userId || req.user._id;

  const user = await findOne(User, { _id: userId });

  if (!user) return next(new AppError('User not found'));

  const matchCount = await Match.countDocuments({ creator: userId });
  const followers = await Follow.countDocuments({ following: userId });
  const following = await Follow.countDocuments({ follower: userId });

  const follow = await findOne(Follow, {
    follower: req.user._id,
    following: userId,
  });

  const isFollowing = follow ? true : false;

  res.status(200).json({
    status: 'success',
    data: {
      matchCount,
      followers,
      following,
      isFollowing,
      user: {
        name: user.fullName,
        image: user.image,
      },
    },
  });
});

const generateColorString = (match) => {
  // Function to extract colors from a team
  const getTeamColors = (team) => {
    if (!team || !team.players || !Array.isArray(team.players)) {
      return [];
    }

    return team.players
      .filter((player) => player.color) // Only include players with color
      .map((player) => player.color);
  };

  // Check creatorTeam first
  if (match.creatorTeam) {
    const creatorColors = getTeamColors(match.creatorTeam);
    if (creatorColors.length > 0) {
      return creatorColors.join(',');
    }
  }

  // Fall back to opponentTeam
  if (match.opponentTeam) {
    const opponentColors = getTeamColors(match.opponentTeam);
    if (opponentColors.length > 0) {
      return opponentColors.join(',');
    }
  }

  // If no colors found, return empty string or default
  return '';
};

// import { createOne, deleteOne, findOne, getAll } from '../factory/repo.js';
// import { findOneAndUpdate } from '../factory/userRepo.js';
// import Match from '../models/Match.js';
// import AppError from '../utils/appError.js';
// import catchAsync from '../utils/catchAsync.js';
// import fs from 'fs';
// import { uploadLargeFile } from './s3UploadService.js';
// import User from '../models/User.js';
// import Follow from '../models/Follow.js';

// export const createMatchServiceService = catchAsync(async (req, res, next) => {
//   const match = await createOne(Match, req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       match,
//     },
//   });
// });

// export const getMatchService = catchAsync(async (req, res, next) => {
//   const match = await findOne(Match, {
//     _id: req.params.matchId,
//     creator: req.user._id,
//   });

//   console.log(req.params.matchId, req.user._id, match);

//   if (!match)
//     return next(
//       new AppError(
//         'No match found or you are not authorized to view this match',
//         404
//       )
//     );

//   res.status(200).json({
//     status: 'success',
//     data: {
//       match,
//     },
//   });
// });

// export const getAllMatchesService = catchAsync(async (req, res, next) => {
//   const { _id: userId } = req.user;

//   req.query.creator = userId;

//   const matches = await getAll(Match, req.query);

//   res.status(200).json({
//     status: 'success',
//     data: {
//       matches,
//     },
//   });
// });

// export const updateMatchService = catchAsync(async (req, res, next) => {
//   const match = await findOneAndUpdate(
//     Match,
//     { _id: req.params.matchId, creator: req.user._id },
//     req.body
//   );

//   if (!match)
//     return next(
//       new AppError(
//         'No match found or you are not authorized to update this match',
//         404
//       )
//     );

//   res.status(200).json({
//     status: 'success',
//     data: {
//       match,
//     },
//   });
// });

// export const deleteMatchService = catchAsync(async (req, res, next) => {
//   const match = await deleteOne(Match, {
//     _id: req.params.matchId,
//     creator: req.user._id,
//   });

//   if (!match)
//     return next(
//       new AppError(
//         'No match found or you are not authorized to delete this match',
//         404
//       )
//     );

//   res.status(204).json({
//     status: 'success',
//     data: null,
//   });
// });

// /**
//  * Handles the upload of a video file for a match.
//  *
//  * This service checks if the match exists and belongs to the authenticated user,
//  * ensures that a video is not already attached to the match, uploads the video
//  * to a storage service, and updates the match with the video URL.
//  *
//  * @async
//  * @function uploadVideoService
//  * @param {Object} req - The request object.
//  * @param {Object} req.file - The uploaded file object.
//  * @param {string} req.file.path - The temporary file path of the uploaded video.
//  * @param {string} req.file.originalname - The original name of the uploaded video file.
//  * @param {Object} req.body - The request body.
//  * @param {string} req.body.matchId - The ID of the match to attach the video to.
//  * @param {Object} req.user - The authenticated user object.
//  * @param {string} req.user._id - The ID of the authenticated user.
//  * @param {Object} res - The response object.
//  * @param {Function} next - The next middleware function.
//  * @throws {AppError} If the match is not found or does not belong to the user.
//  * @throws {AppError} If the match already has a video attached.
//  * @returns {void}
//  */
// export const uploadVideoService = catchAsync(async (req, res, next) => {
//   try {
//     const { path: tempPath, originalname } = req.file;

//     const match = await findOne(Match, {
//       _id: req.body.matchId,
//       creator: req.user._id,
//     });

//     if (!match) return next(new AppError('Match not found', 404));

//     if (match.video)
//       return next(
//         new AppError('Match already has a video attached to it', 400)
//       );

//     // Core Upload Execution
//     const result = await uploadLargeFile(tempPath, originalname);

//     // Cleanup temporary file
//     fs.unlinkSync(tempPath);

//     match.video = result.Location;

//     await match.save();

//     res.status(200).json({
//       status: 'success',
//       message: 'Uploaded successfully',
//       data: {
//         match,
//       },
//     });
//   } catch (error) {
//     console.error('Upload failed:', error);
//     res.status(500).json({ error: 'Upload failed' });
//   }
// });

// export const getUserProfileService = catchAsync(async (req, res, next) => {
//   const userId = req.query.userId || req.user._id;

//   const user = await findOne(User, { _id: userId });

//   if (!user) return next(new AppError('User not found'));

//   const matchCount = await Match.countDocuments({ creator: userId });
//   const followers = await Follow.countDocuments({ following: userId });
//   const following = await Follow.countDocuments({ follower: userId });

//   const follow = await findOne(Follow, {
//     follower: req.user._id,
//     following: userId,
//   });

//   const isFollowing = follow ? true : false;

//   res.status(200).json({
//     status: 'success',
//     data: {
//       matchCount,
//       followers,
//       following,
//       isFollowing,
//       user: {
//         name: user.fullName,
//         image: user.image,
//       },
//     },
//   });
// });

// // export const getPresignedUrl = catchAsync(async (req, res, next) => {
// //   const command = new GetObjectCommand({
// //     Bucket: process.env.S3_BUCKET_NAME,
// //     Key: fileName,
// //   });

// //   const signedUrl = await getSign;
// // });
