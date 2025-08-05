import mongoose from 'mongoose';

// Schema for shot events
const shotEventSchema = new mongoose.Schema(
  {
    frame: {
      type: Number,
      required: true,
    },
    start_frame: {
      type: Number,
      required: true,
    },
    end_frame: {
      type: Number,
      required: true,
    },
    ball_pos: {
      type: [Number],
      required: true,
    },
    player_pos: {
      type: [Number],
      required: true,
    },
    velocity: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['forehand', 'backhand', 'volley', 'smash'],
    },
    success: {
      type: Boolean,
      required: true,
    },
  },
  { _id: false }
);

// Schema for shots summary
const shotsSchema = new mongoose.Schema(
  {
    total_shots: {
      type: Number,
      required: true,
      min: 0,
    },
    forehand: {
      type: Number,
      required: true,
      min: 0,
    },
    backhand: {
      type: Number,
      required: true,
      min: 0,
    },
    volley: {
      type: Number,
      required: true,
      min: 0,
    },
    smash: {
      type: Number,
      required: true,
      min: 0,
    },
    success: {
      type: Number,
      required: true,
      min: 0,
    },
    success_rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

// Schema for individual players
const playerSchema = new mongoose.Schema(
  {
    color: {
      type: [Number],
      required: true,
      // validate: {
      //   validator: function (arr) {
      //     return arr.length === 3 && arr.every((val) => val >= 0 && val <= 255);
      //   },
      //   message: 'Color must be an array of 3 RGB values (0-255)',
      // },
    },
    average_speed_kmh: {
      type: Number,
      required: true,
      min: 0,
    },
    total_distance_km: {
      type: Number,
      required: true,
      min: 0,
    },
    average_distance_from_center_km: {
      type: Number,
      required: true,
      min: 0,
    },
    calories_burned: {
      type: Number,
      required: true,
      min: 0,
    },
    shots: {
      type: shotsSchema,
      required: true,
    },
    shot_events: {
      type: [shotEventSchema],
      required: true,
    },
    highlight_urls: {
      type: [String],
      required: true,
      // validate: {
      //   validator: function (arr) {
      //     return arr.every((url) => {
      //       try {
      //         new URL(url);
      //         return true;
      //       } catch {
      //         return false;
      //       }
      //     });
      //   },
      //   message: 'All highlight URLs must be valid URLs',
      // },
    },
  },
  { _id: false }
);

// Schema for player analytics metadata
const metadataSchema = new mongoose.Schema(
  {
    duration_minutes: {
      type: Number,
      required: true,
      min: 0,
    },
    date_analysed: {
      type: Date,
      required: true,
    },
    frame_shape: {
      type: [Number],
      required: true,
      // validate: {
      //   validator: function (arr) {
      //     return arr.length === 2 && arr.every((val) => val > 0);
      //   },
      //   message:
      //     'Frame shape must be an array of 2 positive numbers [height, width]',
      // },
    },
    fps: {
      type: Number,
      required: true,
      min: 0,
    },
    num_players: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// Schema for player analytics
const playerAnalyticsSchema = new mongoose.Schema(
  {
    metadata: {
      type: metadataSchema,
      required: true,
    },
    players: {
      type: [playerSchema],
      required: true,
      // validate: {
      //   validator: function (arr) {
      //     return arr.length > 0;
      //   },
      //   message: 'At least one player must be present',
      // },
    },
  },
  { _id: false }
);

// Schema for files
const filesSchema = new mongoose.Schema(
  {
    player_analytics: {
      type: String,
      validate: {
        validator: function (url) {
          if (!url) return true; // Allow null/undefined
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Player analytics URL must be a valid URL',
      },
    },
    player_heatmap_overlay: {
      type: String,
      // validate: {
      //   validator: function (url) {
      //     if (!url) return true;
      //     try {
      //       new URL(url);
      //       return true;
      //     } catch {
      //       return false;
      //     }
      //   },
      //   message: 'Player heatmap overlay URL must be a valid URL',
      // },
    },
    performance_analysis: {
      type: String,
      default: null,
    },
    heatmap_analysis: {
      type: String,
      default: null,
    },
    plots: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    heatmap_images: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    processed_video: {
      type: String,
      default: null,
    },
    raw_data: {
      type: String,
      default: null,
    },
    highlights: {
      type: Map,
      of: [String],
      required: true,
      // validate: {
      //   validator: function (highlights) {
      //     // Validate that all URLs in highlights are valid
      //     for (const [key, urls] of highlights) {
      //       if (!Array.isArray(urls)) return false;
      //       for (const url of urls) {
      //         try {
      //           new URL(url);
      //         } catch {
      //           return false;
      //         }
      //       }
      //     }
      //     return true;
      //   },
      //   message: 'All highlight URLs must be valid URLs',
      // },
    },
  },
  { _id: false }
);

// Schema for analysis metadata
const analysisMetadataSchema = new mongoose.Schema(
  {
    created_at: {
      type: Date,
      required: true,
    },
    completed_at: {
      type: Date,
      required: true,
    },
    storage: {
      type: String,
      required: true,
      enum: ['s3', 'local', 'gcs', 'azure'],
    },
  },
  { _id: false }
);

// Main Analysis schema
const analysisSchema = new mongoose.Schema(
  {
    match_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        'pending',
        'processing',
        'progressing',
        'completed',
        'failed',
        'cancelled',
      ],
      default: 'pending',
    },
    player_analytics: {
      type: playerAnalyticsSchema,
      required: function () {
        return this.status === 'completed';
      },
    },
    files: {
      type: filesSchema,

      required: function () {
        return this.status === 'completed';
      },
    },
    metadata: {
      type: analysisMetadataSchema,
      required: function () {
        return this.status === 'completed';
      },
    },
    // Additional fields for tracking
    error_message: {
      type: String,
      required: function () {
        return this.status === 'failed';
      },
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'analyses',
  }
);

// Indexes for better query performance
analysisSchema.index({ match_id: 1, status: 1 });
analysisSchema.index({ created_by: 1, status: 1 });
analysisSchema.index({ 'metadata.created_at': -1 });

// Virtual for getting player count
analysisSchema.virtual('playerCount').get(function () {
  return this.player_analytics?.players?.length || 0;
});

// Virtual for getting total shots across all players
analysisSchema.virtual('totalShots').get(function () {
  if (!this.player_analytics?.players) return 0;
  return this.player_analytics.players.reduce((total, player) => {
    return total + (player.shots?.total_shots || 0);
  }, 0);
});

// Virtual for getting analysis duration
analysisSchema.virtual('analysisDuration').get(function () {
  if (!this.metadata?.created_at || !this.metadata?.completed_at) return null;
  return (
    new Date(this.metadata.completed_at) - new Date(this.metadata.created_at)
  );
});

// Method to get player by index
analysisSchema.methods.getPlayer = function (index) {
  return this.player_analytics?.players?.[index] || null;
};

// Method to get highlights for a specific player
analysisSchema.methods.getPlayerHighlights = function (playerIndex) {
  return this.files?.highlights?.get(playerIndex.toString()) || [];
};

// Method to get all highlight URLs
analysisSchema.methods.getAllHighlights = function () {
  if (!this.files?.highlights) return [];
  const allHighlights = [];
  for (const [playerIndex, urls] of this.files.highlights) {
    allHighlights.push(...urls);
  }
  return allHighlights;
};

// Static method to find analyses by status
analysisSchema.statics.findByStatus = function (status) {
  return this.find({ status });
};

// Static method to find completed analyses for a user
analysisSchema.statics.findCompletedByUser = function (userId) {
  return this.find({
    created_by: userId,
    status: 'completed',
  }).sort({ 'metadata.completed_at': -1 });
};

// Pre-save middleware to update the updated_at field
analysisSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

// Pre-save middleware to validate status transitions
analysisSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const validTransitions = {
      pending: ['processing', 'failed', 'cancelled'],
      processing: ['completed', 'failed', 'cancelled'],
      progressing: ['completed', 'failed', 'cancelled'],
      completed: [], // No transitions from completed
      failed: ['pending'], // Can retry
      cancelled: ['pending'], // Can restart
    };

    if (this.isNew) {
      // Allow any initial status
      return next();
    }

    const currentStatus = this.get('status');
    const previousStatus = this.$locals.previousStatus;

    if (
      previousStatus &&
      validTransitions[previousStatus] &&
      !validTransitions[previousStatus].includes(currentStatus)
    ) {
      return next(
        new Error(
          `Invalid status transition from ${previousStatus} to ${currentStatus}`
        )
      );
    }
  }
  next();
});

// Post-init middleware to track previous status
analysisSchema.post('init', function () {
  this.$locals.previousStatus = this.status;
});

const Analysis = mongoose.model('Analysis', analysisSchema);

export default Analysis;
