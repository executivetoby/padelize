import { model, Schema } from 'mongoose';

const tokenSchema = new Schema(
  {
    pin: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Token = model('Token', tokenSchema);

export default Token;
