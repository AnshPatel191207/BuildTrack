import mongoose, { Schema } from 'mongoose';

const dailyReportSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    date: { type: Date, required: true },
    summary: { type: String, trim: true, maxlength: 2000 },
    weather: {
      type: String,
      enum: ['sunny', 'cloudy', 'rainy', 'humid', 'windy', 'other'],
      default: 'sunny',
    },
    workCompleted: { type: String, trim: true, maxlength: 2000 },
    workersPresent: { type: Number, default: 0, min: 0 },
    materialsUsed: { type: String, trim: true, maxlength: 1000 },
    issues: { type: String, trim: true, maxlength: 1000 },
    safetyNotes: { type: String, trim: true, maxlength: 1000 },
    tomorrowPlan: { type: String, trim: true, maxlength: 1000 },
    photos: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// One report per project per day.
dailyReportSchema.index({ projectId: 1, date: 1 }, { unique: true });

dailyReportSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    if (ret.date) ret.date = new Date(ret.date).toISOString().slice(0, 10);
    return ret;
  },
});

export const DailyReport =
  mongoose.models.DailyReport ?? mongoose.model('DailyReport', dailyReportSchema);
