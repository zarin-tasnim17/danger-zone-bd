"use client";

import { useEffect, useState } from "react";
import DynamicMap from "@/components/map/DynamicMap";
import { checkApiHealth, checkDbHealth } from "@/lib/api";
import { useMapStore } from "@/store/useMapStore";
import { io, Socket } from "socket.io-client";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>("Checking...");
  const [dbStatus, setDbStatus] = useState<string>("Checking...");
  const [socketStatus, setSocketStatus] = useState<string>("Disconnected");
  const mapMode = useMapStore((state) => state.mode);
  const setMapMode = useMapStore((state) => state.setMode);

  useEffect(() => {
    checkApiHealth().then((res) => {
      setApiStatus(res?.success ? "Online" : "Offline");
    });
    checkDbHealth().then((res) => {
      setDbStatus(res?.success ? "Online" : "Offline");
    });

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
    const socket: Socket = io(socketUrl, {
      reconnectionDelayMax: 10000,
    });

    socket.on("connect", () => setSocketStatus("Connected"));
    socket.on("disconnect", () => setSocketStatus("Disconnected"));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center">
      <header className="w-full bg-blue-900 text-white p-4 shadow-md flex justify-between items-center z-10">
        <h1 className="text-2xl font-bold">BD Safety Map</h1>
        <div className="flex gap-4 text-sm">
          <span>API: {apiStatus}</span>
          <span>DB: {dbStatus}</span>
          <span>Socket: {socketStatus}</span>
        </div>
      </header>

      <div className="flex w-full flex-1 relative">
        <div className="absolute top-4 left-4 z-[400] bg-white p-2 rounded shadow flex gap-2">
          <button 
            className={`px-3 py-1 rounded ${mapMode === 'basic' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setMapMode('basic')}
          >Basic</button>
          <button 
            className={`px-3 py-1 rounded ${mapMode === 'heatmap' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setMapMode('heatmap')}
          >Heatmap</button>
          <button 
            className={`px-3 py-1 rounded ${mapMode === 'labeled' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setMapMode('labeled')}
          >Labeled</button>
        </div>
        <DynamicMap />
      </div>
    </main>
  );
}
