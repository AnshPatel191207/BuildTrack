import mongoose, { Schema } from 'mongoose';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 400 },
    type: {
      type: String,
      enum: [
        'low_stock',
        'overdue_task',
        'expense',
        'attendance',
        'milestone',
        'report_reminder',
        'general',
        'payment_overdue',
        'milestone_delay',
        'contractor_bill',
        'purchase_approval',
        'expense_approval',
        'new_booking',
        'pending_task',
        'document_expiry',
      ],
      default: 'general',
    },
    isRead: { type: Boolean, default: false, index: true },
    relatedProjectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Notification =
  mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);
