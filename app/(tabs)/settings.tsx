import { useState, useCallback, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useTankConnection } from "@/lib/tank-connection";

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function ProgressRow({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <View style={styles.progressItem}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={[styles.progressValue, { color }]}>{value}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function tempColor(t: number): string {
  if (t > 75) return "#FF4444";
  if (t > 60) return "#FFD700";
  return "#00FF88";
}

function cpuColor(c: number): string {
  if (c > 80) return "#FF4444";
  if (c > 50) return "#FFD700";
  return "#00FF88";
}

function ramColor(r: number): string {
  if (r > 85) return "#FF4444";
  if (r > 60) return "#FFD700";
  return "#7AA2F7";
}

function batColor(b: number): string {
  if (b < 20) return "#FF4444";
  if (b < 40) return "#FFD700";
  return "#00FF88";
}

interface AudioDevice {
  name: string;
  index?: number;
  type?: string;
  isDefault?: boolean;
}

export default function SettingsScreen() {
  const {
    piAddress,
    piPort,
    setPiAddress,
    setPiPort,
    connected,
    connect,
    disconnect,
    sysinfo,
    baseUrl,
  } = useTankConnection();

  const [localIp, setLocalIp] = useState(piAddress);
  const [localPort, setLocalPort] = useState(piPort);
  const [volume, setVolume] = useState(80);
  const [ttsText, setTtsText] = useState("");
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [testingMic, setTestingMic] = useState(false);
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const [micTestResult, setMicTestResult] = useState<string | null>(null);

  const handleConnect = useCallback(() => {
    setPiAddress(localIp);
    setPiPort(localPort);
    setTimeout(() => connect(), 100);
  }, [localIp, localPort, setPiAddress, setPiPort, connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // Fetch audio devices from Pi
  const fetchAudioDevices = useCallback(async () => {
    if (!connected) return;
    setLoadingDevices(true);
    try {
      const response = await fetch(`${baseUrl}/api/audio/devices`);
      const data = await response.json();
      if (data.ok && data.devices) {
        setAudioDevices(data.devices);
      } else if (data.ok && Array.isArray(data.input)) {
        // Alternative format
        const devices: AudioDevice[] = [];
        if (data.input) {
          data.input.forEach((d: any) =>
            devices.push({ name: d.name || d, type: "input", index: d.index })
          );
        }
        if (data.output) {
          data.output.forEach((d: any) =>
            devices.push({ name: d.name || d, type: "output", index: d.index })
          );
        }
        setAudioDevices(devices);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingDevices(false);
    }
  }, [connected, baseUrl]);

  // Fetch volume from Pi
  const fetchVolume = useCallback(async () => {
    if (!connected) return;
    try {
      const response = await fetch(`${baseUrl}/api/audio/volume_get`);
      const data = await response.json();
      if (data.ok && typeof data.volume === "number") {
        setVolume(data.volume);
      }
    } catch {
      // Silently fail
    }
  }, [connected, baseUrl]);

  useEffect(() => {
    if (connected) {
      fetchAudioDevices();
      fetchVolume();
    }
  }, [connected, fetchAudioDevices, fetchVolume]);

  const handleVolumeChange = useCallback(
    async (val: number) => {
      setVolume(val);
      if (!connected) return;
      try {
        await fetch(`${baseUrl}/api/audio/volume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ percent: val }),
        });
      } catch {}
    },
    [connected, baseUrl]
  );

  const handleSpeak = useCallback(async () => {
    if (!ttsText.trim() || !connected) return;
    try {
      await fetch(`${baseUrl}/api/audio/say`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText }),
      });
      setTtsText("");
    } catch (err: any) {
      if (Platform.OS !== "web") {
        Alert.alert("Erro", err.message);
      }
    }
  }, [ttsText, connected, baseUrl]);

  const handleTestSpeaker = useCallback(async () => {
    if (!connected) return;
    setTestingSpeaker(true);
    try {
      await fetch(`${baseUrl}/api/audio/test_speaker`, { method: "POST" });
    } catch {}
    setTimeout(() => setTestingSpeaker(false), 2000);
  }, [connected, baseUrl]);

  const handleTestMic = useCallback(async () => {
    if (!connected) return;
    setTestingMic(true);
    setMicTestResult(null);
    try {
      const response = await fetch(`${baseUrl}/api/audio/test_mic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: 3 }),
      });
      const data = await response.json();
      if (data.ok) {
        setMicTestResult(data.text || data.message || "Mic OK - Áudio capturado com sucesso");
      } else {
        setMicTestResult(data.error || "Falha no teste do microfone");
      }
    } catch (err: any) {
      setMicTestResult(`Erro: ${err.message}`);
    } finally {
      setTestingMic(false);
    }
  }, [connected, baseUrl]);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Connection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONEXÃO PI</Text>
          <View style={styles.connStatus}>
            <View style={[styles.connDot, connected ? styles.connDotOk : styles.connDotErr]} />
            <Text style={[styles.connText, connected ? styles.connTextOk : styles.connTextErr]}>
              {connected ? "Conectado" : "Desconectado"}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Endereço IP</Text>
            <TextInput
              style={styles.textInput}
              value={localIp}
              onChangeText={setLocalIp}
              placeholder="192.168.1.215"
              placeholderTextColor="#555"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Porta</Text>
            <TextInput
              style={styles.textInput}
              value={localPort}
              onChangeText={setLocalPort}
              placeholder="5000"
              placeholderTextColor="#555"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.btnRow}>
            <Pressable
              onPress={handleConnect}
              style={({ pressed }) => [styles.btn, styles.btnSuccess, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.btnSuccessText}>Conectar</Text>
            </Pressable>
            <Pressable
              onPress={handleDisconnect}
              style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.btnDangerText}>Desconectar</Text>
            </Pressable>
          </View>
        </View>

        {/* Audio Devices (USB Mic) */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>DISPOSITIVOS DE ÁUDIO</Text>
            <Pressable
              onPress={fetchAudioDevices}
              style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
              disabled={!connected}
            >
              <Text style={styles.refreshBtnText}>↻ Atualizar</Text>
            </Pressable>
          </View>

          {!connected && (
            <Text style={styles.noData}>Conecte ao Pi para ver dispositivos</Text>
          )}

          {connected && loadingDevices && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#00FF88" />
              <Text style={styles.loadingText}>Buscando dispositivos...</Text>
            </View>
          )}

          {connected && !loadingDevices && audioDevices.length === 0 && (
            <Text style={styles.noData}>Nenhum dispositivo encontrado</Text>
          )}

          {audioDevices.map((device, i) => (
            <View key={i} style={styles.deviceRow}>
              <View style={styles.deviceIcon}>
                <Text style={styles.deviceIconText}>
                  {device.type === "input" ? "🎤" : "🔊"}
                </Text>
              </View>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName} numberOfLines={1}>
                  {device.name}
                </Text>
                <Text style={styles.deviceType}>
                  {device.type === "input" ? "Entrada (Mic)" : "Saída (Speaker)"}
                  {device.isDefault ? " ★ Padrão" : ""}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.micTestSection}>
            <Text style={styles.sectionLabel}>TESTE DE MICROFONE USB</Text>
            <Pressable
              onPress={handleTestMic}
              style={({ pressed }) => [
                styles.btn,
                styles.btnOutline,
                testingMic && styles.btnActive,
                pressed && { opacity: 0.7 },
              ]}
              disabled={!connected || testingMic}
            >
              {testingMic ? (
                <View style={styles.testingRow}>
                  <ActivityIndicator size="small" color="#7AA2F7" />
                  <Text style={styles.btnOutlineText}>Gravando 3s...</Text>
                </View>
              ) : (
                <Text style={styles.btnOutlineText}>🎤 Testar Microfone</Text>
              )}
            </Pressable>
            {micTestResult && (
              <View style={styles.micResultBox}>
                <Text style={styles.micResultText}>{micTestResult}</Text>
              </View>
            )}
          </View>
        </View>

        {/* System Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>INFORMAÇÕES DO SISTEMA</Text>
          {sysinfo ? (
            <>
              <ProgressRow
                label="CPU"
                value={`${sysinfo.cpu.toFixed(0)}%`}
                pct={sysinfo.cpu}
                color={cpuColor(sysinfo.cpu)}
              />
              <ProgressRow
                label="RAM"
                value={`${sysinfo.ram_used} / ${sysinfo.ram_tot} MB`}
                pct={sysinfo.ram_pct}
                color={ramColor(sysinfo.ram_pct)}
              />
              <InfoRow
                label="Temperatura"
                value={`${sysinfo.temp}°C`}
                color={tempColor(sysinfo.temp)}
              />
              <InfoRow label="Memória GPU" value={sysinfo.gpu_mem} />
              <InfoRow label="Endereço IP" value={sysinfo.ip} color="#00FF88" />

              {sysinfo.ard_bat && sysinfo.ard_bat.pct >= 0 && (
                <ProgressRow
                  label="Bateria Arduino"
                  value={`${sysinfo.ard_bat.pct}% (${sysinfo.ard_bat.v}V)`}
                  pct={sysinfo.ard_bat.pct}
                  color={batColor(sysinfo.ard_bat.pct)}
                />
              )}

              {sysinfo.pi_bat && sysinfo.pi_bat.pct >= 0 && (
                <ProgressRow
                  label="Bateria Pi"
                  value={`${sysinfo.pi_bat.pct}% (${sysinfo.pi_bat.v}V)`}
                  pct={sysinfo.pi_bat.pct}
                  color={batColor(sysinfo.pi_bat.pct)}
                />
              )}
            </>
          ) : (
            <Text style={styles.noData}>
              {connected ? "Aguardando dados do sistema..." : "Conecte ao Pi para ver informações"}
            </Text>
          )}
        </View>

        {/* Audio Controls */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONTROLES DE ÁUDIO</Text>

          <View style={styles.volumeRow}>
            <Text style={styles.volumeLabel}>Volume</Text>
            <Pressable
              onPress={() => handleVolumeChange(Math.max(0, volume - 10))}
              style={({ pressed }) => [styles.volBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.volBtnText}>-</Text>
            </Pressable>
            <Text style={styles.volumeValue}>{volume}%</Text>
            <Pressable
              onPress={() => handleVolumeChange(Math.min(100, volume + 10))}
              style={({ pressed }) => [styles.volBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.volBtnText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.btnRow}>
            <Pressable
              onPress={handleTestSpeaker}
              style={({ pressed }) => [
                styles.btn,
                styles.btnOutline,
                pressed && { opacity: 0.7 },
              ]}
              disabled={!connected || testingSpeaker}
            >
              <Text style={styles.btnOutlineText}>
                {testingSpeaker ? "Tocando..." : "🔊 Testar Speaker"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.ttsRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={ttsText}
              onChangeText={setTtsText}
              placeholder="Texto para falar..."
              placeholderTextColor="#555"
              returnKeyType="done"
              onSubmitEditing={handleSpeak}
            />
            <Pressable
              onPress={handleSpeak}
              style={({ pressed }) => [styles.btn, styles.btnSuccess, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.btnSuccessText}>Falar</Text>
            </Pressable>
          </View>
        </View>

        {/* Voice Config */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CONFIGURAÇÃO DE VOZ</Text>
          <InfoRow label="Wake Word" value='"Wall-E"' color="#00FF88" />
          <InfoRow label="STT Engine" value="Whisper (Pi)" />
          <InfoRow label="TTS Engine" value="pyttsx3 (Pi)" />
          <InfoRow label="Idioma" value="Português (pt-BR)" />
          <Text style={styles.helpText}>
            Na aba Chat, toque no 🎤 para gravar do celular ou use "Mic Pi" para gravar pelo microfone USB do robô. A IA responde e pode controlar o robô automaticamente.
          </Text>
        </View>

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SOBRE</Text>
          <InfoRow label="App" value="Tank Brain Controller" />
          <InfoRow label="Versão" value="1.1.0" />
          <InfoRow label="Robô" value="Tank Pi Brain v1.0" />
          <InfoRow label="Arduino" value="Tank v6 Pi-Slave" />
          <InfoRow label="Wake Word" value="Wall-E" color="#00FF88" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  scrollContent: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 10,
    color: "#8B949E",
    letterSpacing: 1.5,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#30363D",
  },
  refreshBtnText: {
    fontSize: 10,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  connStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connDotOk: {
    backgroundColor: "#00FF88",
    shadowColor: "#00FF88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  connDotErr: {
    backgroundColor: "#FF4444",
  },
  connText: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  connTextOk: {
    color: "#00FF88",
  },
  connTextErr: {
    color: "#FF4444",
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  textInput: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 8,
    color: "#E6EDF3",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  btnSuccess: {
    backgroundColor: "#1A3A2A",
    borderColor: "#00FF88",
  },
  btnSuccessText: {
    color: "#00FF88",
    fontWeight: "bold",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  btnDanger: {
    backgroundColor: "#3D1515",
    borderColor: "#FF4444",
  },
  btnDangerText: {
    color: "#FF4444",
    fontWeight: "bold",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  btnOutline: {
    backgroundColor: "#21262D",
    borderColor: "#30363D",
  },
  btnActive: {
    borderColor: "#7AA2F7",
    backgroundColor: "rgba(122,162,247,0.08)",
  },
  btnOutlineText: {
    color: "#E6EDF3",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  testingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Device list
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#21262D",
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#21262D",
    justifyContent: "center",
    alignItems: "center",
  },
  deviceIconText: {
    fontSize: 16,
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
  },
  deviceName: {
    fontSize: 12,
    color: "#E6EDF3",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  deviceType: {
    fontSize: 10,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  micTestSection: {
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#21262D",
  },
  sectionLabel: {
    fontSize: 9,
    color: "#8B949E",
    letterSpacing: 1,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  micResultBox: {
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 6,
    padding: 10,
  },
  micResultText: {
    fontSize: 11,
    color: "#7AA2F7",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    lineHeight: 16,
  },
  helpText: {
    fontSize: 11,
    color: "#8B949E",
    lineHeight: 16,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  // System Info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#21262D",
  },
  infoLabel: {
    fontSize: 12,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  infoValue: {
    fontSize: 12,
    color: "#E6EDF3",
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  progressItem: {
    gap: 4,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 12,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  progressValue: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#21262D",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  noData: {
    color: "#555",
    fontSize: 12,
    fontStyle: "italic",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  // Audio
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  volumeLabel: {
    fontSize: 12,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    flex: 1,
  },
  volumeValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E6EDF3",
    minWidth: 50,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  volBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#21262D",
    borderWidth: 1,
    borderColor: "#30363D",
    justifyContent: "center",
    alignItems: "center",
  },
  volBtnText: {
    fontSize: 18,
    color: "#E6EDF3",
    fontWeight: "bold",
  },
  ttsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
});
