import { useEffect, useRef, useCallback } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Platform,
  Image,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useTankConnection } from "@/lib/tank-connection";

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(style);
  }
}

export default function ControlScreen() {
  useKeepAwake();
  const { connected, status, sendCommand, setMode, baseUrl, connect } = useTankConnection();
  const pressedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connected) {
      connect();
    }
  }, []);

  const handlePressIn = useCallback(
    (cmd: string) => {
      if (status.mode === "auto") return;
      pressedRef.current = cmd;
      haptic();
      sendCommand(cmd);
    },
    [status.mode, sendCommand]
  );

  const handlePressOut = useCallback(
    (cmd: string) => {
      if (cmd !== "S" && pressedRef.current === cmd) {
        sendCommand("S");
      }
      pressedRef.current = null;
    },
    [sendCommand]
  );

  const toggleMode = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    const newMode = status.mode === "manual" ? "auto" : "manual";
    setMode(newMode);
  }, [status.mode, setMode]);

  const isAuto = status.mode === "auto";
  const cameraUri = connected ? `${baseUrl}/video` : null;

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.title}>Tank Brain</Text>
          <View style={styles.statusDots}>
            <View style={styles.dotRow}>
              <View style={[styles.dot, connected ? styles.dotOk : styles.dotErr]} />
              <Text style={styles.dotLabel}>Pi</Text>
            </View>
            <View style={styles.dotRow}>
              <View style={[styles.dot, status.camera_ok ? styles.dotOk : styles.dotErr]} />
              <Text style={styles.dotLabel}>Cam</Text>
            </View>
            <View style={styles.dotRow}>
              <View style={[styles.dot, status.arduino_ok ? styles.dotOk : styles.dotErr]} />
              <Text style={styles.dotLabel}>Ard</Text>
            </View>
          </View>
          <View style={[styles.modeBadge, isAuto ? styles.modeBadgeAuto : styles.modeBadgeManual]}>
            <Text style={[styles.modeBadgeText, isAuto ? styles.modeTextAuto : styles.modeTextManual]}>
              {isAuto ? "AUTO" : "MANUAL"}
            </Text>
          </View>
          <View style={styles.cmdBadge}>
            <Text style={styles.cmdBadgeText}>CMD: {status.motor}</Text>
          </View>
        </View>

        {/* Camera Feed */}
        <View style={styles.cameraWrap}>
          {cameraUri ? (
            <Image
              source={{ uri: cameraUri }}
              style={styles.cameraImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.cameraPlaceholderText}>
                {connected ? "Loading camera..." : "Not connected"}
              </Text>
              <Text style={styles.cameraSubtext}>
                {connected ? "" : "Go to Settings to configure Pi address"}
              </Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controlsRow}>
          {/* D-Pad */}
          <View style={styles.dpad}>
            <View style={styles.dpadRow}>
              <View style={styles.dpadEmpty} />
              <Pressable
                onPressIn={() => handlePressIn("F")}
                onPressOut={() => handlePressOut("F")}
                style={({ pressed }) => [styles.dpadBtn, pressed && styles.dpadBtnPressed]}
              >
                <Text style={styles.dpadBtnText}>▲</Text>
              </Pressable>
              <View style={styles.dpadEmpty} />
            </View>
            <View style={styles.dpadRow}>
              <Pressable
                onPressIn={() => handlePressIn("L")}
                onPressOut={() => handlePressOut("L")}
                style={({ pressed }) => [styles.dpadBtn, pressed && styles.dpadBtnPressed]}
              >
                <Text style={styles.dpadBtnText}>◀</Text>
              </Pressable>
              <Pressable
                onPressIn={() => handlePressIn("S")}
                onPressOut={() => {}}
                style={({ pressed }) => [styles.dpadBtn, styles.stopBtn, pressed && styles.stopBtnPressed]}
              >
                <Text style={styles.stopBtnText}>STOP</Text>
              </Pressable>
              <Pressable
                onPressIn={() => handlePressIn("R")}
                onPressOut={() => handlePressOut("R")}
                style={({ pressed }) => [styles.dpadBtn, pressed && styles.dpadBtnPressed]}
              >
                <Text style={styles.dpadBtnText}>▶</Text>
              </Pressable>
            </View>
            <View style={styles.dpadRow}>
              <View style={styles.dpadEmpty} />
              <Pressable
                onPressIn={() => handlePressIn("B")}
                onPressOut={() => handlePressOut("B")}
                style={({ pressed }) => [styles.dpadBtn, pressed && styles.dpadBtnPressed]}
              >
                <Text style={styles.dpadBtnText}>▼</Text>
              </Pressable>
              <View style={styles.dpadEmpty} />
            </View>
          </View>

          {/* Mode & Info */}
          <View style={styles.modeSection}>
            <Pressable
              onPress={toggleMode}
              style={({ pressed }) => [
                styles.modeToggle,
                isAuto ? styles.modeToggleAuto : styles.modeToggleManual,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.modeToggleText, isAuto ? styles.modeToggleTextAuto : styles.modeToggleTextManual]}>
                {isAuto ? "MANUAL" : "AUTO"}
              </Text>
              <Text style={styles.modeHint}>
                {isAuto ? "Switch to manual" : "Enable autopilot"}
              </Text>
            </Pressable>

            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Port</Text>
              <Text style={styles.infoValue}>{status.arduino_port}</Text>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#161B22",
    borderBottomWidth: 1,
    borderBottomColor: "#30363D",
    gap: 12,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00FF88",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  statusDots: {
    flexDirection: "row",
    gap: 10,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  dotOk: {
    backgroundColor: "#00FF88",
    shadowColor: "#00FF88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  dotErr: {
    backgroundColor: "#FF4444",
  },
  dotLabel: {
    fontSize: 11,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  modeBadgeAuto: {
    backgroundColor: "#1A3A2A",
    borderColor: "#00FF88",
  },
  modeBadgeManual: {
    backgroundColor: "#1A1A3A",
    borderColor: "#7AA2F7",
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  modeTextAuto: {
    color: "#00FF88",
  },
  modeTextManual: {
    color: "#7AA2F7",
  },
  cmdBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFD700",
    backgroundColor: "#2A2A1A",
  },
  cmdBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFD700",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  cameraWrap: {
    flex: 1,
    margin: 10,
    backgroundColor: "#000",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#30363D",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraImage: {
    width: "100%",
    height: "100%",
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraPlaceholderText: {
    color: "#8B949E",
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  cameraSubtext: {
    color: "#555",
    fontSize: 12,
    marginTop: 8,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 20,
  },
  dpad: {
    gap: 4,
  },
  dpadRow: {
    flexDirection: "row",
    gap: 4,
  },
  dpadEmpty: {
    width: 64,
    height: 64,
  },
  dpadBtn: {
    width: 64,
    height: 64,
    backgroundColor: "#21262D",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dpadBtnPressed: {
    backgroundColor: "rgba(0,255,136,0.13)",
    borderColor: "#00FF88",
    shadowColor: "#00FF88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    transform: [{ scale: 0.93 }],
  },
  dpadBtnText: {
    fontSize: 24,
    color: "#E6EDF3",
  },
  stopBtn: {
    backgroundColor: "#2A1515",
    borderColor: "#FF4444",
  },
  stopBtnPressed: {
    backgroundColor: "rgba(255,68,68,0.13)",
    borderColor: "#FF4444",
    transform: [{ scale: 0.93 }],
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FF4444",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  modeSection: {
    flex: 1,
    gap: 12,
    alignItems: "center",
  },
  modeToggle: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    width: "100%",
  },
  modeToggleAuto: {
    borderColor: "#00FF88",
    backgroundColor: "#1A3A2A",
  },
  modeToggleManual: {
    borderColor: "#7AA2F7",
    backgroundColor: "#1A1A3A",
  },
  modeToggleText: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  modeToggleTextAuto: {
    color: "#00FF88",
  },
  modeToggleTextManual: {
    color: "#7AA2F7",
  },
  modeHint: {
    fontSize: 10,
    color: "#8B949E",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  infoBox: {
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 8,
    padding: 10,
    width: "100%",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 10,
    color: "#8B949E",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  infoValue: {
    fontSize: 13,
    color: "#E6EDF3",
    fontWeight: "bold",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
});
