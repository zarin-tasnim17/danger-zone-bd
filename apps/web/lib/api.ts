import { ApiResponse } from "@repo/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function checkApiHealth(): Promise<ApiResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("API Health Check failed", error);
    return null;
  }
}

export async function checkDbHealth(): Promise<ApiResponse | null> {
  try {
    const res = await fetch(`${API_URL}/health/db`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("DB Health Check failed", error);
    return null;
  }
}
