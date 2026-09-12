import mongoose, { Schema } from 'mongoose';
import type { AttendanceStatus } from '../types';

/**
 * One attendance record per worker per calendar day.
 * The compound unique index is the source of truth for duplicate prevention —
 * the service layer translates the E11000 error into a friendly 409.
 */
const attendanceSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true, index: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'leave'],
      required: true,
    },
    checkIn: { type: String, default: null }, // "HH:mm" 24h format
    checkOut: { type: String, default: null },
    overtimeHours: { type: Number, default: 0, min: 0, max: 12 },
    remarks: { type: String, trim: true, maxlength: 300 },
    geo: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      distanceMeters: { type: Number, min: 0 },
      _id: false,
    },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

attendanceSchema.index({ workerId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ projectId: 1, date: 1 });

attendanceSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    ret.date && (ret.date = new Date(ret.date).toISOString().slice(0, 10));
    return ret;
  },
});

export const Attendance =
  mongoose.models.Attendance ?? mongoose.model('Attendance', attendanceSchema);
