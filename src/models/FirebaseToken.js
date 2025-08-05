import { model, Schema } from 'mongoose';
const firebaseTokenSchema = new Schema(
  {
    user: {
      type: String,
      required: [true, 'A token must have a user'],
    },
    regid: {
      type: String,
      required: [true, 'A token must have a regid'],
    },
  },
  {
    timestamps: true,
  }
);

const FirebaseToken = model('FirebaseToken', firebaseTokenSchema);

export default FirebaseToken;
