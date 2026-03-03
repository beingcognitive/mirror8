import { GenerationResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function generateFutures(
  file: File,
  accessToken: string,
  aboutMe?: string,
): Promise<GenerationResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (aboutMe) {
    formData.append("about_me", aboutMe);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
  } catch {
    // Network error, timeout, or connection refused — always retryable
    const err = new Error("Connection lost. The server may be busy — please try again.");
    (err as any).retryable = true;
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    const err = new Error(errorData.detail || errorData.error || "Generation failed");
    (err as any).retryable = errorData.retryable === true;
    throw err;
  }

  return response.json();
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
