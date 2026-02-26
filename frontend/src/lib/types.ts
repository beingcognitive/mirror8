export interface FuturePersona {
  id: string;
  name: string;
  title: string;
  backstory: string;
  hasPortrait: boolean;
  portraitUrl?: string;
}

export interface GenerationResult {
  sessionId: string;
  futures: FuturePersona[];
}

export type ConnectionStatus =
  | "idle"
  | "permissions"
  | "connecting"
  | "active"
  | "reconnecting"
  | "error"
  | "ended";

export interface TranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type AvatarMood = "idle" | "listening" | "speaking";

// WebSocket message types (client → server)
export interface WSImageMessage {
  type: "image";
  data: string; // base64
  mimeType: string;
}

export interface WSTextMessage {
  type: "text";
  text: string;
}

export interface WSPingMessage {
  type: "ping";
}

// WebSocket message types (server → client)
export interface WSTranscriptMessage {
  type: "transcript";
  role: "user" | "agent";
  text: string;
}

export interface WSTurnCompleteMessage {
  type: "turn_complete";
}

export interface WSInterruptedMessage {
  type: "interrupted";
}

export interface WSPongMessage {
  type: "pong";
}

export interface WSErrorMessage {
  type: "error";
  message: string;
}

export type WSServerMessage =
  | WSTranscriptMessage
  | WSTurnCompleteMessage
  | WSInterruptedMessage
  | WSPongMessage
  | WSErrorMessage;
