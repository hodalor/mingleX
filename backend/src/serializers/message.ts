export function toMessage(message: {
  _id: { toString(): string };
  match: { toString(): string };
  sender: { toString(): string };
  text: string;
  createdAt: Date;
  readAt?: Date | null;
}) {
  return {
    id: message._id.toString(),
    matchId: message.match.toString(),
    senderId: message.sender.toString(),
    text: message.text,
    createdAt: message.createdAt,
    readAt: message.readAt ?? null,
  };
}
