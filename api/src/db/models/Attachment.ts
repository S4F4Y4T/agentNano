import { Schema, model, Types } from "mongoose";

const attachmentSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storageRelativePath: { type: String, required: true },
  },
  { timestamps: true }
);

export interface AttachmentDoc {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  messageId: Types.ObjectId | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageRelativePath: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Attachment = model("Attachment", attachmentSchema);
