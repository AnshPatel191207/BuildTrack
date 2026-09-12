import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { UserRole } from '../types';

export interface UserDocument extends mongoose.HydratedDocument<any> {
  _id: any;
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  role: UserRole;
  avatar?: string | null;
  companyId: any | null;
  assignedProjects: any[];
  isActive: boolean;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: [
        'super_admin',
        'owner',
        'project_manager',
        'site_engineer',
        'accountant',
        'sales_manager',
        'supervisor',
        'manager',
        'engineer',
        'worker',
      ],
      default: 'owner',
      index: true,
    },
    avatar: { type: String, default: null },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
    assignedProjects: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.methods.verifyPassword = async function (plain: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = (plain: string) => bcrypt.hash(plain, 10);

userSchema.set('toJSON', {
  transform(_doc, ret: any) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

interface UserModel extends mongoose.Model<UserDocument> {
  hashPassword(plain: string): Promise<string>;
}

export const User = (mongoose.models.User ??
  mongoose.model<UserDocument, UserModel>('User', userSchema)) as any;
