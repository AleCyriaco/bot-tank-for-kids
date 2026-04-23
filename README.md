# 🤖 Tank Brain Controller

Mobile app built with **Expo / React Native** to control a **Raspberry Pi 5 robot tank** with AI vision, voice commands, and real-time sensor monitoring.

## Features

- 🎮 **D-Pad Controls** — Forward, backward, left, right with press-and-hold
- 📷 **Live Camera Feed** — Real-time MJPEG stream from the robot's camera
- 🤖 **Manual / Auto Mode** — Toggle between manual control and autonomous driving
- 📡 **Sensor Dashboard** — Ultrasonic distance, IR sensors, servo angle, vision zones
- 🧠 **AI Chat (Wall-E)** — Chat with the robot's AI that sees through the camera
- 🎤 **Voice Control** — USB mic on Pi records voice → Whisper STT → AI response → robot commands
- 📊 **System Info** — CPU, RAM, temperature, battery levels
- 🔊 **Audio Controls** — Speaker volume, mic gain, TTS (text-to-speech)

## Hardware

| Component | Details |
|-----------|---------|
| Computer | Raspberry Pi 5 |
| Controller | Arduino (Tank v6 Pi-Slave) |
| Camera | OV5647 (MJPEG stream) |
| Speaker | USB PnP Audio Device (JMTek) |
| Microphone | USB2.0 Device (Intel) |
| Display | SPI screen with animated face |
| Wake Word | "Wall-E" |

## Tech Stack

- **Mobile App**: Expo SDK 54, React Native 0.81, TypeScript, NativeWind (Tailwind CSS)
- **Pi Server**: Flask + SocketIO (port 5000)
- **AI**: OpenAI / Claude (configurable in `ai_config.json`)
- **STT**: Whisper (local on Pi)
- **TTS**: pyttsx3 (local on Pi)

## Getting Started

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/AleCyriaco/bot-tank-for-kids.git
   cd bot-tank-for-kids
   pnpm install
   ```

2. Start the dev server:
   ```bash
   pnpm dev
   ```

3. Scan the QR code with **Expo Go** on your phone (must be on the same WiFi as the Pi)

4. In the **Settings** tab, enter your Pi's IP address (default: `192.168.1.215`) and port `5000`

## Pi Server Setup

The robot runs `tank_server.py` on the Raspberry Pi. Make sure it's running:
```bash
sudo systemctl start tank
```

Configure the AI API key in `/home/oper/tank/ai_config.json`:
```json
{
  "provider": "openai",
  "api_key": "sk-..."
}
```

## Documentation

See [`DOCUMENTACAO.md`](./DOCUMENTACAO.md) for full technical documentation in Portuguese.

## License

MIT
