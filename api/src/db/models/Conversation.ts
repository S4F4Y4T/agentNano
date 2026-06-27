import { Schema, model, Types } from "mongoose";

const conversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, default: "New chat" },
    lastMessageAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

conversationSchema.index({ title: "text" });

export interface ConversationDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const Conversation = model("Conversation", conversationSchema);
