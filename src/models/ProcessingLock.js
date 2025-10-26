import mongoose from 'mongoose';

const ProcessingLockSchema = new mongoose.Schema(
  {
    matchId: {
      // type: mongoose.Schema.Types.ObjectId,
      type: String,
      required: true,
      unique: true,
      ref: 'Match',
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index for auto-cleanup
    },
  },
  {
    timestamps: true,
  }
);

const ProcessingLock = mongoose.model('ProcessingLock', ProcessingLockSchema);

export default ProcessingLock;
