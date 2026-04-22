# Tank Brain Mobile App — Interface Design

## Overview

The Tank Brain mobile app is a controller for a Raspberry Pi 5-based robot tank designed for kids. It connects via WiFi to the Pi's Flask+SocketIO server (port 5000) and provides real-time control, monitoring, and AI interaction. The app is designed for **mobile portrait orientation (9:16)** and **one-handed usage**, following Apple Human Interface Guidelines.

## Screen List

| Screen | Tab | Description |
|--------|-----|-------------|
| Control | Home Tab | Main screen: live camera feed + D-pad + mode toggle |
| Sensors | Sensors Tab | Distance bars, IR indicators, vision zones, servo angle |
| AI Chat | Chat Tab | AI assistant chat with text/voice input |
| Settings | Settings Tab | Pi connection config, system info, network management |

## Color Choices

The app uses a dark "tech" theme inspired by the original web UI, evoking a futuristic robot control panel feel.

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| primary | #00FF88 | #00FF88 | Main accent — green glow (matches original) |
| background | #0D1117 | #0D1117 | Deep dark background |
| surface | #161B22 | #161B22 | Cards, panels |
| foreground | #E6EDF3 | #E6EDF3 | Primary text |
| muted | #8B949E | #8B949E | Secondary text |
| border | #30363D | #30363D | Borders, dividers |
| success | #00FF88 | #00FF88 | Connected, OK states |
| warning | #FFD700 | #FFD700 | Caution, medium distance |
| error | #FF4444 | #FF4444 | Danger, disconnected |

## Screen Details

### 1. Control Screen (Home Tab)

This is the primary screen. It occupies the full tab area and is divided vertically:

**Top Section (60%)**: Live MJPEG camera feed from the Pi (`/video` endpoint). Displayed in a 4:3 aspect ratio container with rounded corners. An overlay shows the current mode badge (MANUAL / AUTO) and connection status dots (Camera, Arduino).

**Bottom Section (40%)**: Control panel with:
- A 3x3 D-pad grid: Forward, Left, Stop, Right, Backward buttons. Large touch targets (minimum 60x60pt). The Stop button is centered and red-accented.
- Mode toggle button: switches between Manual and Auto. Green border for Auto, blue for Manual.
- Current motor command badge (CMD: F/B/L/R/S).

Touch controls use press-and-hold for movement (send command on press, send Stop on release). Haptic feedback on button press.

### 2. Sensors Screen

Displays real-time sensor data from the robot in a scrollable card layout:

**Distance Card**: Three horizontal bar gauges for Front (df), Left (de), Right (dd) distances in cm. Color-coded: green (>30cm), yellow (15-30cm), red (<15cm). Each bar shows the numeric value.

**IR Sensors Card**: Two boxes side by side for Left IR (ie) and Right IR (id). Shows analog value and highlights red when obstacle detected (<500).

**Vision Card**: Three vertical bar columns for Left, Center, Right vision zones. Height proportional to edge detection intensity. Red when above threshold (25), green otherwise.

**Servo Card**: Shows current servo sweep angle (sv) with a simple gauge or numeric display.

### 3. AI Chat Screen

A chat interface similar to messaging apps:

**Header**: Shows current AI provider (OpenAI/Claude) and connection status.

**Message Area**: Scrollable list of messages. User messages right-aligned (blue), AI messages left-aligned (green), system messages centered (gray).

**Input Area**: Text input field with Send button. A microphone button for voice input (uses device speech recognition). Option to include camera snapshot for vision-based AI queries.

### 4. Settings Screen

Scrollable list of configuration sections:

**Connection Section**: Input field for Pi IP address (default: 192.168.1.215). Port field (default: 5000). Connect/Disconnect button. Connection status indicator.

**System Info Section**: Displays Pi system stats received via SocketIO: CPU usage, RAM usage, temperature, GPU memory, IP address, Arduino battery, Pi battery. Each with a small progress bar.

**Audio Section**: Volume slider for Pi speaker. Test speaker button. TTS text input with speak button.

**About Section**: App version, robot name, link to project info.

## Key User Flows

### Flow 1: Connect and Drive
1. User opens app → Control screen loads
2. App auto-connects to saved Pi IP via SocketIO
3. Connection status dots turn green
4. Camera feed appears in top section
5. User presses Forward on D-pad → tank moves forward
6. User releases → Stop command sent → tank stops
7. User taps Mode toggle → switches to Auto → tank navigates autonomously

### Flow 2: Chat with AI
1. User taps Chat tab
2. Types "What do you see?" in input
3. App sends message to Pi's `/api/ai/chat` with current camera frame
4. AI responds describing the environment
5. Response appears as green bubble with any movement commands highlighted

### Flow 3: Monitor Sensors
1. User taps Sensors tab
2. Real-time sensor data streams via SocketIO
3. Distance bars animate as robot moves
4. IR indicators flash red when obstacles detected

### Flow 4: Configure Connection
1. User taps Settings tab
2. Enters Pi IP address
3. Taps Connect
4. Status updates to show connected/disconnected
5. System info populates with Pi stats

## Navigation

Four-tab bottom navigation bar with icons:
- **Control** (gamepad icon) — Home tab
- **Sensors** (gauge icon) — Sensor dashboard
- **Chat** (chat bubble icon) — AI assistant
- **Settings** (gear icon) — Configuration

## Typography

- Monospace font family (Courier New / system monospace) for sensor values and technical data
- System font for chat messages and general UI text
- Bold for headings and important values

## Interaction Patterns

- D-pad buttons: press-and-hold for continuous movement, release to stop
- Haptic feedback: Light impact on button press, Medium on mode toggle
- Pull-to-refresh: not needed (real-time SocketIO updates)
- Keep screen awake while on Control tab (expo-keep-awake)
