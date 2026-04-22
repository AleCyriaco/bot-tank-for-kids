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
      text: '🤖 Tank Brain AI Assistant\nDiga "Wall-E" ou toque no microfone para conversar por voz!\nA IA vê pela câmera do robô em tempo real 👁',
      commands: [],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useVision, setUseVision] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [autoExecCommands, setAutoExecCommands] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (isRecording) {
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
  }, [isRecording, pulseAnim]);

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
      // Stop after last command
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

          // Auto-execute commands
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

  // Voice recording - record from phone mic, send to Pi for STT
  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") {
      // Web: use MediaRecorder API
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: "audio/webm" });
          await sendAudioToSTT(blob);
        };

        (window as any).__tankMediaRecorder = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
        setRecordingSeconds(0);
        recordTimerRef.current = setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);

        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (err: any) {
        addMessage({
          role: "error",
          text: `Erro ao acessar microfone: ${err.message}`,
        });
      }
    } else {
      // Native: use expo-audio recording
      try {
        const ExpoAudio = await import("expo-audio");
        const { granted } = await ExpoAudio.requestRecordingPermissionsAsync();
        if (!granted) {
          addMessage({
            role: "error",
            text: "Permissão de microfone negada. Habilite nas configurações do dispositivo.",
          });
          return;
        }

        await ExpoAudio.setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });

        const recorder = new ExpoAudio.AudioRecorder(ExpoAudio.RecordingPresets.HIGH_QUALITY);
        await recorder.prepareToRecordAsync();
        recorder.record();

        (global as any).__tankRecorder = recorder;
        setIsRecording(true);
        setRecordingSeconds(0);
        recordTimerRef.current = setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (err: any) {
        addMessage({
          role: "error",
          text: `Erro ao iniciar gravação: ${err.message}`,
        });
      }
    }
  }, [addMessage]);

  const stopRecording = useCallback(async () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (Platform.OS === "web") {
      const mediaRecorder = (window as any).__tankMediaRecorder;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    } else {
      const recorder = (global as any).__tankRecorder;
      if (recorder) {
        try {
          await recorder.stop();
          const uri = recorder.uri;
          if (uri) {
            // Read file and send as blob
            const ExpoFS = await import("expo-file-system/legacy");
            const base64 = await ExpoFS.readAsStringAsync(uri, {
              encoding: ExpoFS.EncodingType.Base64,
            });
            const byteChars = atob(base64);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteArray[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: "audio/m4a" });
            await sendAudioToSTT(blob);
          }
        } catch (err: any) {
          addMessage({
            role: "error",
            text: `Erro ao parar gravação: ${err.message}`,
          });
        }
      }
    }
  }, [addMessage]);

  // Send recorded audio to Pi's STT endpoint
  const sendAudioToSTT = useCallback(
    async (audioBlob: Blob) => {
      if (!connected) {
        addMessage({
          role: "error",
          text: "Não conectado ao Pi para transcrição de voz.",
        });
        return;
      }

      addMessage({
        role: "voice",
        text: "🎤 Processando voz...",
      });

      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        const response = await fetch(`${baseUrl}/api/ai/stt`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();

        if (data.ok && data.text) {
          // Remove the "processing" message and show transcribed text
          setMessages((prev) => prev.filter((m) => m.text !== "🎤 Processando voz..."));
          addMessage({
            role: "voice",
            text: `🎤 "${data.text}"`,
          });
          // Send transcribed text to AI
          await sendTextToAI(data.text);
        } else {
          setMessages((prev) => prev.filter((m) => m.text !== "🎤 Processando voz..."));
          addMessage({
            role: "error",
            text: data.error || "Falha na transcrição de voz. Tente novamente.",
          });
        }
      } catch (err: any) {
        setMessages((prev) => prev.filter((m) => m.text !== "🎤 Processando voz..."));
        addMessage({
          role: "error",
          text: `Erro de STT: ${err.message}`,
        });
      } finally {
        setLoading(false);
      }
    },
    [connected, baseUrl, addMessage, sendTextToAI]
  );

  // Use Pi's mic for STT (USB mic on Pi)
  const usePiMic = useCallback(async () => {
    if (!connected) {
      addMessage({
        role: "error",
        text: "Não conectado ao Pi.",
      });
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    addMessage({
      role: "voice",
      text: "🎤 Ouvindo pelo microfone do Pi...",
    });

    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/audio/test_mic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: 5 }),
      });
      const data = await response.json();

      setMessages((prev) =>
        prev.filter((m) => m.text !== "🎤 Ouvindo pelo microfone do Pi...")
      );

      if (data.ok && data.text) {
        addMessage({
          role: "voice",
          text: `🎤 Pi ouviu: "${data.text}"`,
        });
        await sendTextToAI(data.text);
      } else if (data.ok) {
        addMessage({
          role: "system",
          text: "Mic do Pi testado com sucesso. Use /api/ai/stt para transcrição.",
        });
      } else {
        addMessage({
          role: "error",
          text: data.error || "Falha ao usar microfone do Pi.",
        });
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter((m) => m.text !== "🎤 Ouvindo pelo microfone do Pi...")
      );
      addMessage({
        role: "error",
        text: `Erro mic Pi: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [connected, baseUrl, addMessage, sendTextToAI]);

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
                {isRecording ? "Gravando..." : "Pensando..."}
              </Text>
            </View>
          </View>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingBar}>
            <Animated.View
              style={[
                styles.recordingDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.recordingText}>
              Gravando... {recordingSeconds}s
            </Text>
            <Pressable
              onPress={stopRecording}
              style={({ pressed }) => [
                styles.stopRecBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.stopRecText}>PARAR</Text>
            </Pressable>
          </View>
        )}

        {/* Vision toggle + options */}
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
          <Pressable
            onPress={usePiMic}
            style={({ pressed }) => [
              styles.piMicBtn,
              pressed && { opacity: 0.7 },
            ]}
            disabled={loading || !connected}
          >
            <Text style={styles.piMicText}>🔊 Mic Pi</Text>
          </Pressable>
        </View>

        {/* Input */}
        <View style={styles.inputRow}>
          {/* Mic button */}
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            style={({ pressed }) => [
              styles.micBtn,
              isRecording && styles.micBtnRecording,
              pressed && { opacity: 0.7 },
              loading && !isRecording && { opacity: 0.4 },
            ]}
            disabled={loading && !isRecording}
          >
            <Text style={styles.micBtnText}>{isRecording ? "⏹" : "🎤"}</Text>
          </Pressable>

          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder='Diga "Wall-E" ou digite...'
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
    backgroundColor: "rgba(255,68,68,0.08)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,68,68,0.2)",
    gap: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF4444",
  },
  recordingText: {
    flex: 1,
    fontSize: 12,
    color: "#FF6666",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  stopRecBtn: {
    backgroundColor: "rgba(255,68,68,0.15)",
    borderWidth: 1,
    borderColor: "#FF4444",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  stopRecText: {
    fontSize: 11,
    color: "#FF4444",
    fontWeight: "bold",
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
  piMicBtn: {
    backgroundColor: "rgba(122,162,247,0.08)",
    borderWidth: 1,
    borderColor: "rgba(122,162,247,0.3)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  piMicText: {
    fontSize: 11,
    color: "#7AA2F7",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#30363D",
    gap: 6,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(122,162,247,0.13)",
    borderWidth: 1,
    borderColor: "#7AA2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  micBtnRecording: {
    backgroundColor: "rgba(255,68,68,0.2)",
    borderColor: "#FF4444",
  },
  micBtnText: {
    fontSize: 20,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,255,136,0.13)",
    borderWidth: 1,
    borderColor: "#00FF88",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnText: {
    fontSize: 18,
    color: "#00FF88",
  },
});
