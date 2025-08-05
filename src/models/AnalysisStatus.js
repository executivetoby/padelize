import { model, Schema } from 'mongoose';

const analysisStatusSchema = new Schema({
  status: {
    type: String,
    enum: [
      'restarting',
      'pending',
      'in_progress',
      'processing',
      'completed',
      'failed',
    ],
    default: 'pending',
  },
  match_id: {
    type: Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
  },
  progress: {
    type: Number,
  },
  message: {
    type: String,
    default: '',
  },
  created_at: {
    type: Date,
  },
  updated_at: {
    type: Date,
  },
  started_at: Date,
  completed_at: Date,
  duration: Number,
});

export default model('AnalysisStatus', analysisStatusSchema);
