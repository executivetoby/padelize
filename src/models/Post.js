import { model, Schema } from 'mongoose';

const postSchema = new Schema(
  {
    content: {
      type: String,
      trim: true,
    },
    attachment: {
      type: String,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A post must have a user authoring it.'],
    },
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReplyAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

postSchema.virtual('stats', {
  ref: 'Like',
  localField: '_id',
  foreignField: 'target',
  match: { targetType: 'Post' },
  count: true,
});

const Post = model('Post', postSchema);
export default Post;
