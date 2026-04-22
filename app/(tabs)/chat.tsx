import { useState, useRef, useCallback } from "react";
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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useTankConnection } from "@/lib/tank-connection";

interface ChatMessage {
  id: string;
  role: "user" | "ai" | "system" | "error";
  text: string;
  commands?: string[];
  timestamp: Date;
}

export default function ChatScreen() {
  const { connected, baseUrl } = useTankConnection();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      text: "Tank Brain AI Assistant. Send a message to chat.",
      commands: [],
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useVision, setUseVision] = useState(true);
  const flatListRef = useRef<FlatList>(null);

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

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    addMessage({ role: "user", text });

    if (!connected) {
      addMessage({ role: "error", text: "Not connected to Pi. Go to Settings to configure." });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
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
          text: cleanText || "(no response)",
          commands: cmds,
        });
      } else {
        addMessage({
          role: "error",
          text: data.error || "AI request failed",
        });
      }
    } catch (err: any) {
      addMessage({
        role: "error",
        text: `Network error: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, connected, baseUrl, useVision, addMessage]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    const isAi = item.role === "ai";
    const isSystem = item.role === "system";
    const isError = item.role === "error";

    return (
      <View
        style={[
          styles.msgBubble,
          isUser && styles.msgUser,
          isAi && styles.msgAi,
          isSystem && styles.msgSystem,
          isError && styles.msgError,
        ]}
      >
        <Text
          style={[
            styles.msgText,
            isUser && styles.msgTextUser,
            isAi && styles.msgTextAi,
            isSystem && styles.msgTextSystem,
            isError && styles.msgTextError,
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
  }, []);

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <View style={styles.headerRight}>
            <View style={[styles.provBadge, connected && styles.provBadgeOk]}>
              <Text style={[styles.provBadgeText, connected && styles.provBadgeTextOk]}>
                {connected ? "Connected" : "Offline"}
              </Text>
            </View>
          </View>
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

        {/* Loading indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color="#00FF88" />
              <Text style={styles.typingText}>Thinking...</Text>
            </View>
          </View>
        )}

        {/* Vision toggle */}
        <View style={styles.visionRow}>
          <Pressable
            onPress={() => setUseVision(!useVision)}
            style={({ pressed }) => [styles.visionToggle, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.visionCheck, useVision && styles.visionCheckOn]} />
            <Text style={styles.visionLabel}>Include camera vision</Text>
          </Pressable>
        </View>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#161B22",
    borderBottomWidth: 1,
    borderBottomColor: "#30363D",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00FF88",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  visionRow: {
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
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#30363D",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 10,
    color: "#E6EDF3",
    paddingHorizontal: 14,
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
