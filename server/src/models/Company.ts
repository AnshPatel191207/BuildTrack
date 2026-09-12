import mongoose, { Schema } from 'mongoose';

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true, maxlength: 300 },
    logo: { type: String, default: null },
  },
  { timestamps: true },
);

companySchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.__v;
    return ret;
  },
});

export const Company =
  mongoose.models.Company ?? mongoose.model('Company', companySchema);
