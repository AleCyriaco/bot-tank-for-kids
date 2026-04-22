import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";

const STORAGE_KEY = "tank_pi_address";
const DEFAULT_IP = "192.168.1.215";
const DEFAULT_PORT = "5000";

export interface SensorData {
  df: number;
  de: number;
  dd: number;
  ie: number;
  id: number;
  sv: number;
}

export interface VisionData {
  left: number;
  center: number;
  right: number;
}

export interface SysInfo {
  cpu: number;
  ram_used: number;
  ram_tot: number;
  ram_pct: number;
  temp: number;
  gpu_mem: string;
  ip: string;
  ard_bat: { pct: number; v: string } | null;
  pi_bat: { pct: number; v: string; source: string } | null;
}

export interface TankStatus {
  arduino_ok: boolean;
  camera_ok: boolean;
  arduino_port: string;
  mode: string;
  motor: string;
  vision: VisionData;
}

interface TankConnectionContextType {
  socket: Socket | null;
  connected: boolean;
  piAddress: string;
  piPort: string;
  setPiAddress: (addr: string) => void;
  setPiPort: (port: string) => void;
  connect: () => void;
  disconnect: () => void;
  sendCommand: (cmd: string) => void;
  setMode: (mode: string) => void;
  status: TankStatus;
  sensors: SensorData;
  sysinfo: SysInfo | null;
  baseUrl: string;
}

const defaultSensors: SensorData = { df: 999, de: 999, dd: 999, ie: 1023, id: 1023, sv: 90 };
const defaultVision: VisionData = { left: 0, center: 0, right: 0 };
const defaultStatus: TankStatus = {
  arduino_ok: false,
  camera_ok: false,
  arduino_port: "N/A",
  mode: "manual",
  motor: "S",
  vision: defaultVision,
};

const TankConnectionContext = createContext<TankConnectionContextType>({
  socket: null,
  connected: false,
  piAddress: DEFAULT_IP,
  piPort: DEFAULT_PORT,
  setPiAddress: () => {},
  setPiPort: () => {},
  connect: () => {},
  disconnect: () => {},
  sendCommand: () => {},
  setMode: () => {},
  status: defaultStatus,
  sensors: defaultSensors,
  sysinfo: null,
  baseUrl: "",
});

export function TankConnectionProvider({ children }: { children: React.ReactNode }) {
  const [piAddress, setPiAddressState] = useState(DEFAULT_IP);
  const [piPort, setPiPortState] = useState(DEFAULT_PORT);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<TankStatus>(defaultStatus);
  const [sensors, setSensors] = useState<SensorData>(defaultSensors);
  const [sysinfo, setSysinfo] = useState<SysInfo | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const baseUrl = `http://${piAddress}:${piPort}`;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.ip) setPiAddressState(parsed.ip);
          if (parsed.port) setPiPortState(parsed.port);
        } catch {}
      }
    });
  }, []);

  const setPiAddress = useCallback((addr: string) => {
    setPiAddressState(addr);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ip: addr, port: piPort }));
  }, [piPort]);

  const setPiPort = useCallback((port: string) => {
    setPiPortState(port);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ip: piAddress, port }));
  }, [piAddress]);

  const connectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const url = `http://${piAddress}:${piPort}`;
    const s = io(url, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setConnected(false));

    s.on("status", (data: TankStatus) => {
      setStatus((prev) => ({ ...prev, ...data }));
    });

    s.on("status_update", (data: Partial<TankStatus>) => {
      setStatus((prev) => ({ ...prev, ...data }));
    });

    s.on("sensors", (data: Partial<SensorData>) => {
      setSensors((prev) => ({ ...prev, ...data }));
    });

    s.on("motor", (data: { cmd: string }) => {
      setStatus((prev) => ({ ...prev, motor: data.cmd }));
    });

    s.on("sysinfo", (data: SysInfo) => {
      setSysinfo(data);
    });

    socketRef.current = s;
  }, [piAddress, piPort]);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  }, []);

  const sendCommand = useCallback((cmd: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("command", { cmd });
    }
  }, []);

  const setMode = useCallback((mode: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("set_mode", { mode });
      setStatus((prev) => ({ ...prev, mode }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <TankConnectionContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        piAddress,
        piPort,
        setPiAddress,
        setPiPort,
        connect: connectSocket,
        disconnect: disconnectSocket,
        sendCommand,
        setMode,
        status,
        sensors,
        sysinfo,
        baseUrl,
      }}
    >
      {children}
    </TankConnectionContext.Provider>
  );
}

export function useTankConnection() {
  return useContext(TankConnectionContext);
}
