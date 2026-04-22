import { Text, View, ScrollView, StyleSheet, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useTankConnection } from "@/lib/tank-connection";

function distColor(d: number): string {
  if (d < 15) return "#FF4444";
  if (d < 30) return "#FFD700";
  return "#00FF88";
}

function distPct(d: number): number {
  if (d >= 200) return 100;
  return Math.min(100, (d / 200) * 100);
}

function DistanceBar({ label, value }: { label: string; value: number }) {
  const display = isNaN(value) || value > 500 ? "---" : `${value.toFixed(0)}cm`;
  const pct = distPct(value);
  const color = distColor(value);

  return (
    <View style={styles.distItem}>
      <View style={styles.distLabelRow}>
        <Text style={styles.distLabel}>{label}</Text>
        <Text style={[styles.distValue, { color }]}>{display}</Text>
      </View>
      <View style={styles.distBarBg}>
        <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function IrBox({ label, value }: { label: string; value: number }) {
  const isObstacle = value < 500;
  return (
    <View style={[styles.irBox, isObstacle && styles.irBoxObs]}>
      <Text style={[styles.irLabel, isObstacle && styles.irLabelObs]}>{label}</Text>
      <Text style={[styles.irValue, isObstacle && styles.irValueObs]}>{value}</Text>
      <Text style={[styles.irStatus, isObstacle ? styles.irStatusObs : styles.irStatusOk]}>
        {isObstacle ? "OBSTACLE" : "CLEAR"}
      </Text>
    </View>
  );
}

function VisionBar({ label, value }: { label: string; value: number }) {
  const maxVal = 60;
  const threshold = 25;
  const pct = Math.min(100, (value / maxVal) * 100);
  const color = value > threshold ? "#FF4444" : "#00FF88";

  return (
    <View style={styles.visCol}>
      <Text style={styles.visLabel}>{label}</Text>
      <View style={styles.visBarBg}>
        <View style={[styles.visBarFill, { height: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.visValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function SensorsScreen() {
  const { sensors, status, connected } = useTankConnection();

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Connection Warning */}
        {!connected && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>Not connected to Pi</Text>
          </View>
        )}

        {/* Distance Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ULTRASONIC DISTANCE</Text>
          <DistanceBar label="Front (df)" value={sensors.df} />
          <DistanceBar label="Left (de)" value={sensors.de} />
          <DistanceBar label="Right (dd)" value={sensors.dd} />
        </View>

        {/* IR Sensors Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>INFRARED SENSORS</Text>
          <View style={styles.irRow}>
            <IrBox label="Left (IE)" value={sensors.ie} />
            <IrBox label="Right (ID)" value={sensors.id} />
          </View>
        </View>

        {/* Vision Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>VISION ZONES</Text>
          <Text style={styles.cardSubtitle}>Edge detection intensity (threshold: 25)</Text>
          <View style={styles.visRow}>
            <VisionBar label="Left" value={status.vision.left} />
            <VisionBar label="Center" value={status.vision.center} />
            <VisionBar label="Right" value={status.vision.right} />
          </View>
        </View>

        {/* Servo Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SERVO SWEEP</Text>
          <View style={styles.servoRow}>
            <Text style={styles.servoAngle}>{Math.round(sensors.sv)}</Text>
            <Text style={styles.servoDeg}>degrees</Text>
          </View>
          <View style={styles.servoBarBg}>
            <View
              style={[
                styles.servoIndicator,
                { left: `${((sensors.sv - 60) / 60) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.servoLabels}>
            <Text style={styles.servoLabelText}>60</Text>
            <Text style={styles.servoLabelText}>90</Text>
            <Text style={styles.servoLabelText}>120</Text>
          </View>
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
  warningBox: {
    backgroundColor: "#3D1515",
    borderWidth: 1,
    borderColor: "#FF4444",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  warningText: {
    color: "#FF4444",
    fontSize: 13,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  card: {
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 10,
    padding: 14,
  },
  cardTitle: {
    fontSize: 10,
    color: "#8B949E",
    letterSpacing: 1.5,
    fontWeight: "bold",
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  cardSubtitle: {
    fontSize: 10,
    color: "#555",
    marginTop: -8,
    marginBottom: 10,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  // Distance
  distItem: {
    marginBottom: 10,
  },
  distLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  distLabel: {
    fontSize: 12,
    color: "#E6EDF3",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  distValue: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  distBarBg: {
    height: 8,
    backgroundColor: "#21262D",
    borderRadius: 4,
    overflow: "hidden",
  },
  distBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  // IR
  irRow: {
    flexDirection: "row",
    gap: 10,
  },
  irBox: {
    flex: 1,
    backgroundColor: "#21262D",
    borderWidth: 1,
    borderColor: "#30363D",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  irBoxObs: {
    backgroundColor: "#3D1515",
    borderColor: "#FF4444",
  },
  irLabel: {
    fontSize: 11,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  irLabelObs: {
    color: "#FF4444",
  },
  irValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#E6EDF3",
    marginVertical: 4,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  irValueObs: {
    color: "#FF4444",
  },
  irStatus: {
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  irStatusOk: {
    color: "#00FF88",
  },
  irStatusObs: {
    color: "#FF4444",
  },
  // Vision
  visRow: {
    flexDirection: "row",
    gap: 8,
    height: 100,
    alignItems: "flex-end",
  },
  visCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  visLabel: {
    fontSize: 10,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  visBarBg: {
    width: "100%",
    height: 60,
    backgroundColor: "#21262D",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#30363D",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  visBarFill: {
    width: "100%",
    borderRadius: 4,
  },
  visValue: {
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  // Servo
  servoRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 10,
  },
  servoAngle: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#00FF88",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  servoDeg: {
    fontSize: 14,
    color: "#8B949E",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
  servoBarBg: {
    height: 8,
    backgroundColor: "#21262D",
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
  },
  servoIndicator: {
    position: "absolute",
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#00FF88",
    marginLeft: -8,
    shadowColor: "#00FF88",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  servoLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  servoLabelText: {
    fontSize: 10,
    color: "#555",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },
});
