import { model, Schema } from 'mongoose';

const likeSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Polymorphic reference: Like can belong to a Post OR a Reply
  target: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'targetType', // Dynamic reference based on `targetType`
  },
  targetType: {
    type: String,
    required: true,
    enum: ['Post', 'Reply'], // Only allow likes on these models
  },
  likedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for fast queries
likeSchema.index({ user: 1, target: 1 }, { unique: true }); // Prevent duplicate likes
likeSchema.index({ target: 1 }); // For counting likes on a post/reply
likeSchema.index({ target: 1, targetType: 1 }); // For counting likes on a post/reply
likeSchema.index({ createdAt: -1 }); // For sorting by date

const Like = model('Like', likeSchema);
export default Like;
