import { GenerationResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface GenerationProgress {
  type: "analyzing" | "analysis_complete" | "portraits_starting" | "portrait_done" | "storing" | "complete" | "error";
  index?: number;
  total?: number;
  name?: string;
  message?: string;
  retryable?: boolean;
  sessionId?: string;
  futures?: GenerationResult["futures"];
}

export async function generateFuturesStream(
  file: File,
  accessToken: string,
  onProgress: (event: GenerationProgress) => void,
  aboutMe?: string,
): Promise<GenerationResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (aboutMe) {
    formData.append("about_me", aboutMe);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/generate-stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
  } catch (e) {
    console.error("[Mirror8] Network error during generation:", e);
    const err = new Error("Connection lost. The server may be busy — please try again.");
    (err as any).retryable = true;
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    console.error("[Mirror8] Generation API error:", response.status, errorData);
    const err = new Error(errorData.detail || errorData.error || "Generation failed");
    (err as any).retryable = errorData.retryable === true;
    throw err;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: GenerationResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data: GenerationProgress = JSON.parse(line.slice(6));
        console.log("[Mirror8] Progress:", data.type, data);
        onProgress(data);

        if (data.type === "complete" && data.sessionId && data.futures) {
          result = { sessionId: data.sessionId, futures: data.futures };
        }
        if (data.type === "error") {
          console.error("[Mirror8] Generation error from server:", data.message, { retryable: data.retryable });
          const err = new Error(data.message || "Generation failed");
          (err as any).retryable = data.retryable === true;
          throw err;
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Generation failed" && !(e as any).retryable) {
          console.error("[Mirror8] Failed to parse SSE event:", line, e);
        } else {
          throw e;
        }
      }
    }
  }

  if (!result) {
    console.error("[Mirror8] Stream ended without a complete event");
    throw new Error("Generation ended without result");
  }

  return result;
}

export async function getSession(
  sessionId: string,
  accessToken: string,
): Promise<GenerationResult> {
  const response = await fetch(`${API_URL}/api/session/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error("Session not found");
  }
  return response.json();
}

export interface ConversationTranscriptEntry {
  role: "user" | "agent";
  text: string;
  ts: number;
}

export interface Conversation {
  id: string;
  future_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  transcript: ConversationTranscriptEntry[];
  insights: unknown[];
}

export async function getConversationsForFuture(
  sessionId: string,
  futureId: string,
  accessToken: string,
): Promise<Conversation[]> {
  const response = await fetch(
    `${API_URL}/api/session/${sessionId}/conversations/${futureId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return data.conversations;
}

export interface SessionSummary {
  id: string;
  created_at: string;
}

export async function getMySessions(
  accessToken: string,
): Promise<SessionSummary[]> {
  const response = await fetch(`${API_URL}/api/my-sessions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch sessions");
  }
  const data = await response.json();
  return data.sessions;
}
