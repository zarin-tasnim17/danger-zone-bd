export type MapMode = "basic" | "heatmap" | "labeled";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Minimal Socket.IO events for future use
export interface ServerToClientEvents {
  reportAdded: (reportId: string) => void;
}

export interface ClientToServerEvents {
  joinMapBounds: (bounds: any) => void;
}
