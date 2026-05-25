import mongoose from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface IFriendship extends mongoose.Document {
  senderId: string;
  receiverId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  { timestamps: true },
);

FriendshipSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

export const Friendship = mongoose.model<IFriendship>('Friendship', FriendshipSchema);
