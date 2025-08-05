import { model, Schema } from 'mongoose';

const followSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follower is required'],
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Following is required'],
    },
  },
  { timestamps: true }
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });

const Follow = model('Follow', followSchema);
export default Follow;
