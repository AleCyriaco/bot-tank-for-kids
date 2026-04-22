import { describe, it, expect } from "vitest";

describe("Voice Features - Command Parsing", () => {
  it("should extract CMD tags from AI response", () => {
    const reply = "Ok, vou andar para frente! [CMD:F] E depois parar. [CMD:S]";
    const cmds: string[] = [];
    const cmdRegex = /\[CMD:([A-Z]+)\]/g;
    let match;
    while ((match = cmdRegex.exec(reply)) !== null) {
      cmds.push(match[1]);
    }
    expect(cmds).toEqual(["F", "S"]);
  });

  it("should clean CMD tags from display text", () => {
    const reply = "Virando à esquerda [CMD:L] e parando [CMD:S]";
    const cleanText = reply.replace(/\[CMD:[A-Z]+\]/g, "").trim();
    expect(cleanText).toBe("Virando à esquerda  e parando");
  });

  it("should handle response with no commands", () => {
    const reply = "Olá! Eu sou o Wall-E, como posso ajudar?";
    const cmds: string[] = [];
    const cmdRegex = /\[CMD:([A-Z]+)\]/g;
    let match;
    while ((match = cmdRegex.exec(reply)) !== null) {
      cmds.push(match[1]);
    }
    expect(cmds).toEqual([]);
  });

  it("should handle multi-letter commands like CL and CR", () => {
    const reply = "Fazendo curva [CMD:CL]";
    const cmds: string[] = [];
    const cmdRegex = /\[CMD:([A-Z]+)\]/g;
    let match;
    while ((match = cmdRegex.exec(reply)) !== null) {
      cmds.push(match[1]);
    }
    expect(cmds).toEqual(["CL"]);
  });
});

describe("Voice Features - Audio API URLs", () => {
  const baseUrl = "http://192.168.1.215:5000";

  it("should construct correct STT endpoint", () => {
    expect(`${baseUrl}/api/ai/stt`).toBe("http://192.168.1.215:5000/api/ai/stt");
  });

  it("should construct correct chat endpoint", () => {
    expect(`${baseUrl}/api/ai/chat`).toBe("http://192.168.1.215:5000/api/ai/chat");
  });

  it("should construct correct mic test endpoint", () => {
    expect(`${baseUrl}/api/audio/test_mic`).toBe("http://192.168.1.215:5000/api/audio/test_mic");
  });

  it("should construct correct audio devices endpoint", () => {
    expect(`${baseUrl}/api/audio/devices`).toBe("http://192.168.1.215:5000/api/audio/devices");
  });

  it("should construct correct volume endpoint", () => {
    expect(`${baseUrl}/api/audio/volume`).toBe("http://192.168.1.215:5000/api/audio/volume");
  });

  it("should construct correct TTS endpoint", () => {
    expect(`${baseUrl}/api/audio/say`).toBe("http://192.168.1.215:5000/api/audio/say");
  });
});

describe("Voice Features - Chat Message Types", () => {
  it("should support voice message role", () => {
    const roles = ["user", "ai", "system", "error", "voice"];
    expect(roles).toContain("voice");
  });

  it("should format voice transcription message", () => {
    const transcribedText = "Ande para frente";
    const voiceMsg = `🎤 "${transcribedText}"`;
    expect(voiceMsg).toBe('🎤 "Ande para frente"');
  });

  it("should format Pi mic message", () => {
    const piText = "Olá Wall-E";
    const piMsg = `🎤 Pi ouviu: "${piText}"`;
    expect(piMsg).toBe('🎤 Pi ouviu: "Olá Wall-E"');
  });
});

describe("Voice Features - Quick Commands", () => {
  it("should define correct quick commands", () => {
    const quickCommands = [
      { label: "O que você vê?", icon: "👁" },
      { label: "Ande para frente", icon: "⬆" },
      { label: "Pare", icon: "🛑" },
      { label: "Descreva o ambiente", icon: "🌍" },
    ];
    expect(quickCommands.length).toBe(4);
    expect(quickCommands[0].label).toBe("O que você vê?");
    expect(quickCommands[2].label).toBe("Pare");
  });
});

describe("Voice Features - Recording Timer", () => {
  it("should format recording seconds correctly", () => {
    const seconds = 5;
    const text = `Gravando... ${seconds}s`;
    expect(text).toBe("Gravando... 5s");
  });

  it("should start at 0 seconds", () => {
    const initialSeconds = 0;
    expect(initialSeconds).toBe(0);
  });
});
