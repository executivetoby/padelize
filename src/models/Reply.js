import { model, Schema } from 'mongoose';
import Post from './Post.js';

const replySchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'A reply must be attached to a post'],
      index: true,
    },
    content: {
      type: String,
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A reply must have an author'],
    },
    // likes: [
    //   {
    //     type: Schema.Types.ObjectId,
    //     ref: 'Like',
    //   },
    // ],
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

// replySchema.index({ postId: 1 });
replySchema.index({ postId: 1, createdAt: 1 });
replySchema.index({ user: 1, createdAt: -1 });

replySchema.virtual('likeCount', {
  ref: 'Like',
  localField: '_id',
  foreignField: 'target',
  match: { targetType: 'Reply' }, // Only count likes for replies
  count: true,
});

replySchema.post('save', async function () {
  await Post.findByIdAndUpdate(this.postId, {
    $inc: { replyCount: 1 },
    $set: { lastReplyAt: new Date() },
  });
});

const Reply = model('Reply', replySchema);

export default Reply;
