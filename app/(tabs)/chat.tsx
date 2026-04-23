import { useState, useRef, useCallback, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useTankConnection } from "@/lib/tank-connection";
import * as Haptics from "expo-haptics";

interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system" | "error" | "voice";
  text: string;
  commands?: string[];
  timestamp: Date;
}

export default function ChatScreen() {
  const { connected, baseUrl, sendCommand } = useTankConnection();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      text: '🤖 Tank Brain AI Assistant\nToque no 🎤 para falar pelo microfone USB do robô!\nA IA vê pela câmera do robô em tempo real 👁 e controla por comandos.',
      commands: [],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useVision, setUseVision] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [listenSeconds, setListenSeconds] = useState(0);
  const [autoExecCommands, setAutoExecCommands] = useState(true);
  const [listenDuration, setListenDuration] = useState(5);
  const [micAvailable, setMicAvailable] = useState<boolean | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const listenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if Pi has a capture device (USB mic)
  const checkMicAvailability = useCallback(async () => {
    if (!connected) {
      setMicAvailable(null);
      return;
    }
    try {
      const response = await fetch(`${baseUrl}/api/audio/devices`);
      const data = await response.json();
      let hasCapture = false;
      if (data.ok) {
        if (data.devices) {
          hasCapture = data.devices.some((d: any) => d.type === "input");
        } else if (data.input) {
          hasCapture = Array.isArray(data.input) && data.input.length > 0;
        }
        // Also check arecord output if available
        if (data.capture_devices !== undefined) {
          hasCapture = data.capture_devices > 0;
        }
      }
      setMicAvailable(hasCapture);
      if (!hasCapture) {
        // Only show warning once
        setMessages((prev) => {
          const alreadyWarned = prev.some((m) => m.text.includes("nenhum microfone"));
          if (alreadyWarned) return prev;
          return [
            ...prev,
            {
              id: "mic-warning-" + Date.now(),
              role: "system" as const,
              text: "⚠ Nenhum microfone/captura detectado no Pi.\nO adaptador USB atual só tem saída de áudio.\nConecte um microfone USB dedicado para usar voz.\nDica: rode \"arecord -l\" no terminal do Pi.",
              commands: [],
              timestamp: new Date(),
            },
          ];
        });
      }
    } catch {
      // Can't check, assume unknown
      setMicAvailable(null);
    }
  }, [connected, baseUrl]);

  useEffect(() => {
    checkMicAvailability();
  }, [connected, checkMicAvailability]);

  // Pulse animation for listening indicator
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const addMessage = useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    return newMsg;
  }, []);

  // Execute robot commands extracted from AI response
  const executeCommands = useCallback(
    (cmds: string[]) => {
      if (!autoExecCommands || !connected) return;
      cmds.forEach((cmd, index) => {
        setTimeout(() => {
          sendCommand(cmd);
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }, index * 500);
      });
      if (cmds.length > 0) {
        setTimeout(() => {
          sendCommand("S");
        }, cmds.length * 500 + 1000);
      }
    },
    [autoExecCommands, connected, sendCommand]
  );

  const sendTextToAI = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      addMessage({ role: "user", text: text.trim() });

      if (!connected) {
        addMessage({
          role: "error",
          text: "Não conectado ao Pi. Vá em Settings para configurar.",
        });
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`${baseUrl}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            use_vision: useVision,
          }),
        });
        const data = await response.json();

        if (data.ok) {
          const cmds: string[] = [];
          const cmdRegex = /\[CMD:([A-Z]+)\]/g;
          let match;
          let cleanText = data.reply || "";
          while ((match = cmdRegex.exec(cleanText)) !== null) {
            cmds.push(match[1]);
          }
          cleanText = cleanText.replace(/\[CMD:[A-Z]+\]/g, "").trim();

          addMessage({
            role: "ai",
            text: cleanText || "(sem resposta)",
            commands: cmds,
          });

          if (cmds.length > 0) {
            executeCommands(cmds);
          }
        } else {
          addMessage({
            role: "error",
            text: data.error || "Falha na requisição de IA",
          });
        }
      } catch (err: any) {
        addMessage({
          role: "error",
          text: `Erro de rede: ${err.message}`,
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, connected, baseUrl, useVision, addMessage, executeCommands]
  );

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendTextToAI(text);
  }, [input, sendTextToAI]);

  // ========== PRIMARY VOICE: Use Pi's USB Mic ==========
  // The main mic button now tells the Pi to record from its local USB mic,
  // run STT (Whisper) on the recording, and return the transcribed text.
  // This avoids browser STT issues entirely.
  const startPiListening = useCallback(async () => {
    if (!connected) {
      addMessage({
        role: "error",
        text: "Não conectado ao Pi. Vá em Settings para conectar.",
      });
      return;
    }

    // Check if mic is available
    if (micAvailable === false) {
      addMessage({
        role: "error",
        text: "⚠ Nenhum microfone USB detectado no Pi!\n\nO adaptador USB atual (JMTek USB PnP Audio) só tem saída de áudio (speaker).\n\nPara usar voz, conecte um dos seguintes:\n• Mini microfone USB (tipo pendrive)\n• Adaptador USB com entrada P2 de mic\n• Microfone USB de mesa\n\nApós conectar, rode \"arecord -l\" no Pi para confirmar.",
      });
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsListening(true);
    setListenSeconds(0);

    // Start a visual countdown timer
    listenTimerRef.current = setInterval(() => {
      setListenSeconds((s) => s + 1);
    }, 1000);

    addMessage({
      role: "voice",
      text: `🎤 Ouvindo pelo microfone USB do robô (${listenDuration}s)...`,
    });

    setLoading(true);
    try {
      // Call Pi's STT endpoint which records from USB mic and transcribes
      const response = await fetch(`${baseUrl}/api/ai/stt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: listenDuration, use_pi_mic: true }),
      });
      const data = await response.json();

      // Clear the "listening" message
      setMessages((prev) =>
        prev.filter(
          (m) => !m.text.startsWith("🎤 Ouvindo pelo microfone USB")
        )
      );

      if (data.ok && data.text && data.text.trim()) {
        addMessage({
          role: "voice",
          text: `🎤 "${data.text}"`,
        });
        // Send transcribed text to AI chat
        await sendTextToAI(data.text);
      } else if (data.ok) {
        addMessage({
          role: "system",
          text: "Nenhuma fala detectada. Tente novamente mais perto do microfone.",
        });
      } else {
        addMessage({
          role: "error",
          text: data.error || "Falha na transcrição de voz. Verifique o microfone USB.",
        });
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter(
          (m) => !m.text.startsWith("🎤 Ouvindo pelo microfone USB")
        )
      );
      addMessage({
        role: "error",
        text: `Erro ao ouvir: ${err.message}`,
      });
    } finally {
      setLoading(false);
      setIsListening(false);
      setListenSeconds(0);
      if (listenTimerRef.current) {
        clearInterval(listenTimerRef.current);
        listenTimerRef.current = null;
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [connected, baseUrl, listenDuration, addMessage, sendTextToAI]);

  // Quick voice commands
  const quickCommands = [
    { label: "O que você vê?", icon: "👁" },
    { label: "Ande para frente", icon: "⬆" },
    { label: "Pare", icon: "🛑" },
    { label: "Descreva o ambiente", icon: "🌍" },
  ];

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    const isAi = item.role === "ai";
    const isSystem = item.role === "system";
    const isError = item.role === "error";
    const isVoice = item.role === "voice";

    return (
      <View
        style={[
          styles.msgBubble,
          isUser && styles.msgUser,
          isAi && styles.msgAi,
          isSystem && styles.msgSystem,
          isError && styles.msgError,
          isVoice && styles.msgVoice,
        ]}
      >
        <Text
          style={[
            styles.msgText,
            isUser && styles.msgTextUser,
            isAi && styles.msgTextAi,
            isSystem && styles.msgTextSystem,
            isError && styles.msgTextError,
            isVoice && styles.msgTextVoice,
          ]}
        >
          {item.text}
        </Text>
        {item.commands && item.commands.length > 0 && (
          <View style={styles.cmdRow}>
            {item.commands.map((cmd, i) => (
              <View key={i} style={styles.cmdChip}>
                <Text style={styles.cmdChipText}>CMD:{cmd}</Text>
              </View>
            ))}
            <View style={styles.cmdExecBadge}>
              <Text style={styles.cmdExecText}>
                {autoExecCommands ? "Auto-executado" : "Manual"}
              </Text>
            </View>
          </View>
        )}
        <Text style={styles.msgTime}>
          {item.timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  }, [autoExecCommands]);

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Wall-E AI</Text>
            <Text style={styles.headerSubtitle}>
              {useVision ? "👁 Visão ativa" : "💬 Texto"}
              {" | Mic: "}
              {micAvailable === null ? "..." : micAvailable ? "USB Pi ✓" : "Não detectado ✗"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => setAutoExecCommands(!autoExecCommands)}
              style={({ pressed }) => [
                styles.autoExecBadge,
                autoExecCommands && styles.autoExecBadgeOn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.autoExecText,
                  autoExecCommands && styles.autoExecTextOn,
                ]}
              >
                {autoExecCommands ? "AUTO CMD" : "CMD OFF"}
              </Text>
            </Pressable>
            <View style={[styles.provBadge, connected && styles.provBadgeOk]}>
              <Text
                style={[styles.provBadgeText, connected && styles.provBadgeTextOk]}
              >
                {connected ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Commands */}
        <View style={styles.quickRow}>
          {quickCommands.map((qc, i) => (
            <Pressable
              key={i}
              onPress={() => sendTextToAI(qc.label)}
              style={({ pressed }) => [
                styles.quickBtn,
                pressed && { opacity: 0.7 },
              ]}
              disabled={loading}
            >
              <Text style={styles.quickIcon}>{qc.icon}</Text>
              <Text style={styles.quickLabel} numberOfLines={1}>
                {qc.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Loading indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color="#00FF88" />
              <Text style={styles.typingText}>
                {isListening ? `Ouvindo... ${listenSeconds}s` : "Pensando..."}
              </Text>
            </View>
          </View>
        )}

        {/* Listening indicator (Pi mic active) */}
        {isListening && (
          <View style={styles.recordingBar}>
            <Animated.View
              style={[
                styles.recordingDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.recordingText}>
              🎤 Mic USB Pi ouvindo... {listenSeconds}/{listenDuration}s
            </Text>
          </View>
        )}

        {/* Options row: vision toggle + listen duration */}
        <View style={styles.optionsRow}>
          <Pressable
            onPress={() => setUseVision(!useVision)}
            style={({ pressed }) => [
              styles.visionToggle,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[styles.visionCheck, useVision && styles.visionCheckOn]}
            />
            <Text style={styles.visionLabel}>
              {useVision ? "👁 Câmera ON" : "Câmera OFF"}
            </Text>
          </Pressable>
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Duração:</Text>
            {[3, 5, 8, 10].map((d) => (
              <Pressable
                key={d}
                onPress={() => setListenDuration(d)}
                style={({ pressed }) => [
                  styles.durationBtn,
                  listenDuration === d && styles.durationBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.durationBtnText,
                    listenDuration === d && styles.durationBtnTextActive,
                  ]}
                >
                  {d}s
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Input row */}
        <View style={styles.inputRow}>
          {/* Mic button - uses Pi's USB mic */}
          <Pressable
            onPress={startPiListening}
            style={({ pressed }) => [
              styles.micBtn,
              isListening && styles.micBtnListening,
              pressed && { opacity: 0.7 },
              (loading || !connected) && !isListening && { opacity: 0.4 },
            ]}
            disabled={loading || !connected}
          >
            <Text style={styles.micBtnText}>{isListening ? "🔴" : "🎤"}</Text>
          </Pressable>

          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Digite ou fale algo..."
            placeholderTextColor="#555"
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            editable={!loading}
            multiline
          />
          <Pressable
            onPress={sendMessage}
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && { opacity: 0.7 },
              loading && { opacity: 0.4 },
            ]}
            disabled={loading}
          >
            <Text style={styles.sendBtnText}>▶</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#161B22",
    borderBottomWidth: 1,
    borderBottomColor: "#30363D",
  },
  headerLeft: {
    gap: 2,
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#00FF88",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  autoExecBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  autoExecBadgeOn: {
    borderColor: "rgba(0,255,136,0.4)",
    backgroundColor: "rgba(0,255,136,0.08)",
  },
  autoExecText: {
    fontSize: 9,
    color: "#8B949E",
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  autoExecTextOn: {
    color: "#00FF88",
  },
  provBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  provBadgeOk: {
    borderColor: "rgba(0,255,136,0.4)",
  },
  provBadgeText: {
    fontSize: 10,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  provBadgeTextOk: {
    color: "#00FF88",
  },
  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#21262D",
  },
  quickBtn: {
    flex: 1,
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 2,
  },
  quickIcon: {
    fontSize: 14,
  },
  quickLabel: {
    fontSize: 8,
    color: "#8B949E",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  messageList: {
    padding: 14,
    gap: 8,
  },
  msgBubble: {
    maxWidth: "88%",
    padding: 10,
    borderRadius: 12,
  },
  msgUser: {
    alignSelf: "flex-end",
    backgroundColor: "#1A1A3A",
    borderWidth: 1,
    borderColor: "rgba(122,162,247,0.2)",
  },
  msgAi: {
    alignSelf: "flex-start",
    backgroundColor: "#1A3A2A",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.2)",
  },
  msgSystem: {
    alignSelf: "center",
    backgroundColor: "#21262D",
    borderWidth: 1,
    borderColor: "#30363D",
    maxWidth: "100%",
  },
  msgError: {
    alignSelf: "flex-start",
    backgroundColor: "#3D1515",
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.25)",
  },
  msgVoice: {
    alignSelf: "flex-end",
    backgroundColor: "#1A2A3A",
    borderWidth: 1,
    borderColor: "rgba(100,180,255,0.25)",
  },
  msgText: {
    fontSize: 13,
    lineHeight: 20,
  },
  msgTextUser: {
    color: "#C9D1D9",
  },
  msgTextAi: {
    color: "#E6EDF3",
  },
  msgTextSystem: {
    color: "#8B949E",
    fontSize: 11,
    textAlign: "center",
  },
  msgTextError: {
    color: "#FF6666",
  },
  msgTextVoice: {
    color: "#7ABFFF",
  },
  cmdRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  cmdChip: {
    backgroundColor: "rgba(0,255,136,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.25)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cmdChipText: {
    fontSize: 10,
    color: "#00FF88",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  cmdExecBadge: {
    backgroundColor: "rgba(0,255,136,0.05)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cmdExecText: {
    fontSize: 9,
    color: "#00FF88",
    fontStyle: "italic",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  msgTime: {
    fontSize: 9,
    color: "#555",
    marginTop: 4,
    textAlign: "right",
  },
  typingRow: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#1A3A2A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.2)",
    padding: 10,
  },
  typingText: {
    fontSize: 12,
    color: "#00FF88",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(122,162,247,0.08)",
    borderTopWidth: 1,
    borderTopColor: "rgba(122,162,247,0.2)",
    gap: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#7AA2F7",
  },
  recordingText: {
    flex: 1,
    fontSize: 12,
    color: "#7AA2F7",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  visionToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  visionCheck: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#30363D",
    backgroundColor: "#21262D",
  },
  visionCheckOn: {
    backgroundColor: "#00FF88",
    borderColor: "#00FF88",
  },
  visionLabel: {
    fontSize: 11,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  durationLabel: {
    fontSize: 10,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    marginRight: 2,
  },
  durationBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#30363D",
    backgroundColor: "#21262D",
  },
  durationBtnActive: {
    borderColor: "#7AA2F7",
    backgroundColor: "rgba(122,162,247,0.15)",
  },
  durationBtnText: {
    fontSize: 10,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  durationBtnTextActive: {
    color: "#7AA2F7",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#30363D",
    gap: 6,
  },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(122,162,247,0.13)",
    borderWidth: 1,
    borderColor: "#7AA2F7",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  micBtnListening: {
    backgroundColor: "rgba(122,162,247,0.3)",
    borderColor: "#7AA2F7",
  },
  micBtnText: {
    fontSize: 15,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 10,
    color: "#E6EDF3",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    maxHeight: 100,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,255,136,0.13)",
    borderWidth: 1,
    borderColor: "#00FF88",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  sendBtnText: {
    fontSize: 14,
    color: "#00FF88",
  },
});
