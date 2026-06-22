import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export type AuthProvider = 'email' | 'google' | 'apple';

export interface IUser extends mongoose.Document {
  email?: string;
  passwordHash?: string;
  username: string;
  avatarUrl: string;
  authProvider: AuthProvider;
  googleId?: string;
  appleId?: string;
  comparePassword: (password: string) => Promise<boolean>;
}

const UserSchema = new mongoose.Schema(
  {
    // Email is optional: OAuth users (esp. Apple with hidden email) may not provide one.
    // Sparse so multiple emailless accounts don't collide on the unique index.
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Only set for email/password accounts.
    passwordHash: { type: String },
    username: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    authProvider: { type: String, enum: ['email', 'google', 'apple'], default: 'email' },
    googleId: { type: String, unique: true, sparse: true, index: true },
    appleId: { type: String, unique: true, sparse: true, index: true },
  },
  { timestamps: true },
);

UserSchema.methods.comparePassword = function (password: string): Promise<boolean> {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
