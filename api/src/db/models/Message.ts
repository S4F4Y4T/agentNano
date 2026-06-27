import { Schema, model, Types } from "mongoose";

const attachmentRefSchema = new Schema(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, default: "" },
    attachments: { type: [attachmentRefSchema], default: undefined },
  },
  { timestamps: true }
);

messageSchema.index({ content: "text" });

export interface MessageDoc {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  attachments?: { id: string; filename: string; mimeType: string; sizeBytes: number }[];
  createdAt: Date;
  updatedAt: Date;
}

export const Message = model("Message", messageSchema);
