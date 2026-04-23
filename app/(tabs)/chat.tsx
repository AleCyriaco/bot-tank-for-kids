"use client";
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
      text: "🤖 Wall-E AI\nToque no 🎤 para falar pelo microfone USB do robô!\nA IA vê pela câmera do robô em tempo real 👁 e controla por comandos.",
      commands: [],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useVision, setUseVision] = useState(true);
  const [autoExecCommands, setAutoExecCommands] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [listenSeconds, setListenSeconds] = useState(0);
  const [listenDuration, setListenDuration] = useState(5);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation while listening
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
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
        setTimeout(() => sendCommand("S"), cmds.length * 500 + 1000);
      }
    },
    [autoExecCommands, connected, sendCommand]
  );

  const sendTextToAI = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      addMessage({ role: "user", text: text.trim() });

      if (!connected) {
        addMessage({ role: "error", text: "Não conectado ao Pi. Vá em Settings para configurar." });
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`${baseUrl}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), use_vision: useVision }),
        });
        const data = await response.json();

        if (data.ok) {
          const cmds: string[] = [];
          const cmdRegex = /\[CMD:([A-Z]+)\]/g;
          let match;
          let cleanText = data.reply || "";
          while ((match = cmdRegex.exec(cleanText)) !== null) cmds.push(match[1]);
          cleanText = cleanText.replace(/\[CMD:[A-Z]+\]/g, "").trim();
          addMessage({ role: "ai", text: cleanText || "(sem resposta)", commands: cmds });
          if (cmds.length > 0) executeCommands(cmds);
        } else {
          addMessage({ role: "error", text: data.error || "Falha na IA" });
        }
      } catch (err: any) {
        addMessage({ role: "error", text: `Erro de rede: ${err.message}` });
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

  // ── PI USB MIC: Tell Pi to record from its USB mic and transcribe ─────────
  const handleMicPress = useCallback(async () => {
    if (!connected) {
      addMessage({ role: "error", text: "Não conectado ao Pi. Vá em Settings para conectar." });
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsListening(true);
    setListenSeconds(0);

    // Visual countdown
    timerRef.current = setInterval(() => {
      setListenSeconds((s) => s + 1);
    }, 1000);

    addMessage({
      role: "voice",
      text: `🎤 Ouvindo pelo mic USB do Pi (${listenDuration}s)...`,
    });

    setLoading(true);
    try {
      // Call the Pi endpoint that records from USB mic and transcribes
      const response = await fetch(`${baseUrl}/api/ai/stt_pi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: listenDuration }),
      });
      const data = await response.json();

      // Remove the "listening..." message
      setMessages((prev) => prev.filter((m) => !m.text.startsWith("🎤 Ouvindo pelo mic USB")));

      if (data.ok && data.text && data.text.trim()) {
        addMessage({ role: "voice", text: `🎤 "${data.text}"` });
        await sendTextToAI(data.text);
      } else if (data.ok) {
        addMessage({ role: "system", text: "Nenhuma fala detectada. Tente novamente mais perto do microfone." });
      } else {
        addMessage({ role: "error", text: data.error || "Falha na transcrição. Verifique o mic USB e a API key no Pi." });
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => !m.text.startsWith("🎤 Ouvindo pelo mic USB")));
      addMessage({ role: "error", text: `Erro ao ouvir: ${err.message}` });
    } finally {
      setLoading(false);
      setIsListening(false);
      setListenSeconds(0);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [connected, baseUrl, listenDuration, addMessage, sendTextToAI]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

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
          {item.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
              {useVision ? "👁 Visão ativa" : "💬 Texto"} | 🎤 Mic USB Pi
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
              <Text style={[styles.autoExecText, autoExecCommands && styles.autoExecTextOn]}>
                {autoExecCommands ? "AUTO CMD" : "CMD OFF"}
              </Text>
            </Pressable>
            <View style={[styles.provBadge, connected && styles.provBadgeOk]}>
              <Text style={[styles.provBadgeText, connected && styles.provBadgeTextOk]}>
                {connected ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        </View>

        {/* Mic Button — large, centered, right below header */}
        <View style={styles.micSection}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleMicPress}
              style={({ pressed }) => [
                styles.micBtnLarge,
                isListening && styles.micBtnLargeListening,
                pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                (loading || !connected) && !isListening && { opacity: 0.35 },
              ]}
              disabled={(loading || !connected) && !isListening}
            >
              <Text style={styles.micBtnLargeIcon}>{isListening ? "🔴" : "🎤"}</Text>
              <Text style={styles.micBtnLargeLabel}>
                {isListening ? `Gravando... ${listenSeconds}/${listenDuration}s` : "Falar com Wall-E"}
              </Text>
            </Pressable>
          </Animated.View>
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
                <Text style={[styles.durationBtnText, listenDuration === d && styles.durationBtnTextActive]}>
                  {d}s
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Quick Commands */}
        <View style={styles.quickRow}>
          {quickCommands.map((qc, i) => (
            <Pressable
              key={i}
              onPress={() => sendTextToAI(qc.label)}
              style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.7 }]}
              disabled={loading}
            >
              <Text style={styles.quickIcon}>{qc.icon}</Text>
              <Text style={styles.quickLabel} numberOfLines={1}>{qc.label}</Text>
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Loading / Listening indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color="#00FF88" />
              <Text style={styles.typingText}>
                {isListening ? `🎤 Ouvindo... ${listenSeconds}/${listenDuration}s` : "Pensando..."}
              </Text>
            </View>
          </View>
        )}

        {/* Options row */}
        <View style={styles.optionsRow}>
          <Pressable
            onPress={() => setUseVision(!useVision)}
            style={({ pressed }) => [styles.visionToggle, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.visionCheck, useVision && styles.visionCheckOn]} />
            <Text style={styles.visionLabel}>{useVision ? "👁 Câmera ON" : "Câmera OFF"}</Text>
          </Pressable>
        </View>

        {/* Input row — text only */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ou digite uma mensagem..."
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
              (!input.trim() || loading) && { opacity: 0.4 },
            ]}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1117" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2A3A",
    backgroundColor: "#0D1117",
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00FF88",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#7AA2F7",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    marginTop: 2,
  },
  headerRight: { flexDirection: "row", gap: 6, alignItems: "center" },
  autoExecBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1E2A3A",
  },
  autoExecBadgeOn: { borderColor: "#00FF88", backgroundColor: "rgba(0,255,136,0.1)" },
  autoExecText: { fontSize: 9, color: "#7AA2F7", fontWeight: "bold" },
  autoExecTextOn: { color: "#00FF88" },
  provBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#1E2A3A",
    borderWidth: 1,
    borderColor: "#FF4444",
  },
  provBadgeOk: { borderColor: "#00FF88", backgroundColor: "rgba(0,255,136,0.08)" },
  provBadgeText: { fontSize: 9, color: "#FF4444", fontWeight: "bold" },
  provBadgeTextOk: { color: "#00FF88" },
  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2A3A",
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#1E2A3A",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: "#2A3A4A",
  },
  quickIcon: { fontSize: 14 },
  quickLabel: { fontSize: 8, color: "#9BA1A6", marginTop: 2, textAlign: "center" },
  messageList: { padding: 10, gap: 8, paddingBottom: 4 },
  msgBubble: {
    maxWidth: "85%",
    borderRadius: 12,
    padding: 10,
    marginVertical: 2,
  },
  msgUser: { alignSelf: "flex-end", backgroundColor: "#1A3A5C" },
  msgAi: { alignSelf: "flex-start", backgroundColor: "#1E2A1E" },
  msgSystem: { alignSelf: "center", backgroundColor: "#1A1A2E", borderWidth: 1, borderColor: "#2A2A4E" },
  msgError: { alignSelf: "center", backgroundColor: "#2A1A1A", borderWidth: 1, borderColor: "#FF4444" },
  msgVoice: { alignSelf: "flex-start", backgroundColor: "#1A2A1A", borderWidth: 1, borderColor: "#00FF88" },
  msgText: { fontSize: 13, lineHeight: 18, color: "#ECEDEE" },
  msgTextUser: { color: "#7AA2F7" },
  msgTextAi: { color: "#00FF88" },
  msgTextSystem: { color: "#9BA1A6", fontSize: 11, textAlign: "center" },
  msgTextError: { color: "#FF6666", fontSize: 11 },
  msgTextVoice: { color: "#00FF88", fontSize: 12 },
  msgTime: { fontSize: 9, color: "#555", marginTop: 4, alignSelf: "flex-end" },
  cmdRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  cmdChip: {
    backgroundColor: "rgba(122,162,247,0.15)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#7AA2F7",
  },
  cmdChipText: { fontSize: 9, color: "#7AA2F7", fontWeight: "bold" },
  cmdExecBadge: {
    backgroundColor: "rgba(0,255,136,0.1)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#00FF88",
  },
  cmdExecText: { fontSize: 9, color: "#00FF88" },
  typingRow: { paddingHorizontal: 12, paddingVertical: 4 },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1E2A1E",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  typingText: { fontSize: 12, color: "#00FF88" },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(0,255,136,0.07)",
    borderTopWidth: 1,
    borderTopColor: "#00FF88",
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00FF88",
  },
  recordingText: { fontSize: 12, color: "#00FF88" },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#1E2A3A",
    gap: 8,
  },
  visionToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  visionCheck: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#555",
    backgroundColor: "transparent",
  },
  visionCheckOn: { backgroundColor: "#7AA2F7", borderColor: "#7AA2F7" },
  visionLabel: { fontSize: 11, color: "#9BA1A6" },
  micSection: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2A1A00",
    backgroundColor: "rgba(255,120,0,0.05)",
  },
  micBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FF6B00",
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 2.5,
    borderColor: "#FFD700",
    minWidth: 220,
    shadowColor: "#FF6B00",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  micBtnLargeListening: {
    backgroundColor: "#FF3300",
    borderColor: "#FF6B00",
    shadowColor: "#FF3300",
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 10,
  },
  micBtnLargeIcon: { fontSize: 28 },
  micBtnLargeLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFD700",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    letterSpacing: 0.5,
  },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  durationLabel: { fontSize: 10, color: "#555" },
  durationBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#1E2A3A",
    borderWidth: 1,
    borderColor: "#2A3A4A",
  },
  durationBtnActive: { borderColor: "#00FF88", backgroundColor: "rgba(0,255,136,0.1)" },
  durationBtnText: { fontSize: 10, color: "#555" },
  durationBtnTextActive: { color: "#00FF88" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E2A3A",
    backgroundColor: "#0D1117",
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E2A3A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#00FF88",
    flexShrink: 0,
  },
  micBtnListening: {
    backgroundColor: "rgba(0,255,136,0.15)",
    borderColor: "#00FF88",
  },
  micBtnText: { fontSize: 16 },
  textInput: {
    flex: 1,
    backgroundColor: "#1E2A3A",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#ECEDEE",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#2A3A4A",
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#7AA2F7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendBtnText: { fontSize: 14, color: "#0D1117", fontWeight: "bold" },
});
