import mongoose from 'mongoose';

export interface IGameLog extends mongoose.Document {
  roomId: string;
  date: Date;
  mode: string;
  players: string[];
  winners: string[];
  durak: string | null;
  huzurSetting: string;
  actionLog: string[];
}

const GameLogSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  mode: { type: String },
  players: [{ type: String }],
  winners: [{ type: String }],
  durak: { type: String, default: null },
  huzurSetting: { type: String },
  actionLog: [{ type: String }],
});

export const GameLog = mongoose.model<IGameLog>('GameLog', GameLogSchema);
