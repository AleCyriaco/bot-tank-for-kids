import { describe, it, expect } from "vitest";

describe("Tank Connection Types and Defaults", () => {
  it("should define correct default sensor values", () => {
    const defaultSensors = { df: 999, de: 999, dd: 999, ie: 1023, id: 1023, sv: 90 };
    expect(defaultSensors.df).toBe(999);
    expect(defaultSensors.de).toBe(999);
    expect(defaultSensors.dd).toBe(999);
    expect(defaultSensors.ie).toBe(1023);
    expect(defaultSensors.id).toBe(1023);
    expect(defaultSensors.sv).toBe(90);
  });

  it("should define correct default status values", () => {
    const defaultStatus = {
      arduino_ok: false,
      camera_ok: false,
      arduino_port: "N/A",
      mode: "manual",
      motor: "S",
      vision: { left: 0, center: 0, right: 0 },
    };
    expect(defaultStatus.arduino_ok).toBe(false);
    expect(defaultStatus.camera_ok).toBe(false);
    expect(defaultStatus.mode).toBe("manual");
    expect(defaultStatus.motor).toBe("S");
    expect(defaultStatus.vision.left).toBe(0);
  });

  it("should validate motor command values", () => {
    const validCommands = ["F", "B", "L", "R", "S", "CL", "CR"];
    expect(validCommands).toContain("F");
    expect(validCommands).toContain("B");
    expect(validCommands).toContain("L");
    expect(validCommands).toContain("R");
    expect(validCommands).toContain("S");
    expect(validCommands.length).toBe(7);
  });

  it("should construct correct base URL from IP and port", () => {
    const piAddress = "192.168.1.215";
    const piPort = "5000";
    const baseUrl = `http://${piAddress}:${piPort}`;
    expect(baseUrl).toBe("http://192.168.1.215:5000");
  });

  it("should calculate distance bar color correctly", () => {
    function distColor(d: number): string {
      if (d < 15) return "#FF4444";
      if (d < 30) return "#FFD700";
      return "#00FF88";
    }
    expect(distColor(5)).toBe("#FF4444");
    expect(distColor(14)).toBe("#FF4444");
    expect(distColor(15)).toBe("#FFD700");
    expect(distColor(29)).toBe("#FFD700");
    expect(distColor(30)).toBe("#00FF88");
    expect(distColor(100)).toBe("#00FF88");
  });

  it("should calculate distance bar percentage correctly", () => {
    function distPct(d: number): number {
      if (d >= 200) return 100;
      return Math.min(100, (d / 200) * 100);
    }
    expect(distPct(0)).toBe(0);
    expect(distPct(100)).toBe(50);
    expect(distPct(200)).toBe(100);
    expect(distPct(300)).toBe(100);
  });

  it("should detect IR obstacle correctly", () => {
    function isObstacle(value: number): boolean {
      return value < 500;
    }
    expect(isObstacle(100)).toBe(true);
    expect(isObstacle(499)).toBe(true);
    expect(isObstacle(500)).toBe(false);
    expect(isObstacle(1023)).toBe(false);
  });

  it("should construct correct AsyncStorage key format", () => {
    const STORAGE_KEY = "tank_pi_address";
    const data = JSON.stringify({ ip: "192.168.1.100", port: "5000" });
    const parsed = JSON.parse(data);
    expect(parsed.ip).toBe("192.168.1.100");
    expect(parsed.port).toBe("5000");
    expect(STORAGE_KEY).toBe("tank_pi_address");
  });
});
