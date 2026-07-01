import { Schema, model, Types } from "mongoose";

const memorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export interface MemoryDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Memory = model("Memory", memorySchema);
