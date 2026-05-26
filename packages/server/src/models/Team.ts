import mongoose from 'mongoose';

export type TeamMemberRole = 'owner' | 'member';
export type TeamInviteStatus = 'pending' | 'accepted' | 'rejected';

export interface ITeamMember {
  profileId: string;
  role: TeamMemberRole;
  joinedAt: Date;
}

export interface ITeamInvite {
  profileId: string;
  status: TeamInviteStatus;
  invitedAt: Date;
}

export interface ITeam extends mongoose.Document {
  name: string;
  tag: string; // short 2-5 char tag, e.g. "DRK"
  ownerId: string;
  members: ITeamMember[];
  invites: ITeamInvite[];
  eloTeams: number;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 32 },
    tag: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 5,
    },
    ownerId: { type: String, required: true, index: true },
    members: [
      {
        profileId: { type: String, required: true },
        role: { type: String, enum: ['owner', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    invites: [
      {
        profileId: { type: String, required: true },
        status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
        invitedAt: { type: Date, default: Date.now },
      },
    ],
    eloTeams: { type: Number, default: 1000 },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

TeamSchema.index({ eloTeams: -1 });

export const Team = mongoose.model<ITeam>('Team', TeamSchema);
