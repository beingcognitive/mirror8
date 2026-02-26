import { GenerationResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function generateFutures(
  file: File,
  accessToken: string,
): Promise<GenerationResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.detail || error.error || "Generation failed");
  }

  return response.json();
}

export function getPortraitUrl(sessionId: string, futureId: string): string {
  return `${API_URL}/api/session/${sessionId}/portrait/${futureId}`;
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
