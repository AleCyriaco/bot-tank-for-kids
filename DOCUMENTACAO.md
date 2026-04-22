# Tank Brain Controller — Documentação Completa do Projeto

**Versão**: 1.0.0
**Data**: 22 de Abril de 2026
**Autor**: Manus AI

---

## 1. Visão Geral do Sistema

O **Tank Brain Controller** é um aplicativo móvel construído com React Native (Expo SDK 54) que serve como interface de controle para um robô-tanque baseado em Raspberry Pi 5. O sistema completo envolve três camadas de hardware e software que se comunicam em tempo real via WiFi.

O robô-tanque ("Tank Brain") é um projeto educacional voltado para crianças, equipado com câmera, sensores ultrassônicos, sensores infravermelhos, servo motor, alto-falante, microfone e uma tela SPI que exibe uma face animada. O app móvel substitui e aprimora a interface web original, oferecendo controle nativo com feedback tátil, navegação por abas e uma experiência otimizada para uso com uma mão.

### Diagrama de Arquitetura

```
┌──────────────────────┐      WiFi (SocketIO + HTTP)      ┌──────────────────────┐
│   App Móvel (Expo)   │ ◄──────────────────────────────► │  Raspberry Pi 5      │
│                      │                                   │  Flask + SocketIO    │
│  - Control Screen    │    SocketIO: command, sensors,    │  porta 5000          │
│  - Sensors Screen    │    status, sysinfo, motor         │                      │
│  - Chat Screen       │                                   │  ┌────────────────┐  │
│  - Settings Screen   │    HTTP: /video, /api/*           │  │ Camera OV5647  │  │
│                      │                                   │  │ 640x480 MJPEG  │  │
└──────────────────────┘                                   │  └────────────────┘  │
                                                           │                      │
                                                           │  ┌────────────────┐  │
                                                           │  │ Arduino Slave  │  │
                                                           │  │ USB/BT 115200  │  │
                                                           │  │ Motores, Sens. │  │
                                                           │  └────────────────┘  │
                                                           │                      │
                                                           │  ┌────────────────┐  │
                                                           │  │ Face Display   │  │
                                                           │  │ SPI 240x280    │  │
                                                           │  │ porta 8765     │  │
                                                           │  └────────────────┘  │
                                                           └──────────────────────┘
```

---

## 2. Stack Tecnológico

O projeto utiliza tecnologias modernas tanto no lado do app quanto no servidor embarcado no Raspberry Pi.

| Componente | Tecnologia | Versão |
|------------|-----------|--------|
| Framework Mobile | Expo SDK | 54 |
| UI Framework | React Native | 0.81.5 |
| Linguagem | TypeScript | 5.9 |
| Estilização | NativeWind (Tailwind CSS) | 4.x |
| Navegação | Expo Router | 6 |
| Animações | react-native-reanimated | 4.x |
| Comunicação SocketIO | socket.io-client | 4.x |
| Armazenamento Local | AsyncStorage | 2.x |
| Servidor Pi | Flask + Flask-SocketIO | Python 3 |
| Arduino | Sketch C++ (Pi-Slave) | v6 |
| IA | OpenAI / Claude (via Pi) | - |

---

## 3. Estrutura de Arquivos do App

A estrutura segue o padrão Expo Router com navegação baseada em sistema de arquivos. Abaixo estão os arquivos principais organizados por função.

### 3.1 Arquivos de Configuração

| Arquivo | Função |
|---------|--------|
| `app.config.ts` | Configuração principal do Expo: nome do app, ícones, bundle ID, splash screen, plugins |
| `theme.config.js` | Paleta de cores centralizada (tokens usados pelo Tailwind e pelo runtime) |
| `theme.config.d.ts` | Tipagens TypeScript para os tokens de cor |
| `tailwind.config.js` | Configuração do Tailwind CSS com cores do tema |
| `tsconfig.json` | Configuração do TypeScript |
| `package.json` | Dependências e scripts do projeto |
| `babel.config.js` | Configuração do Babel para NativeWind |
| `metro.config.js` | Configuração do Metro bundler |
| `global.css` | Diretivas do Tailwind CSS |

### 3.2 Telas do App (app/)

| Arquivo | Descrição |
|---------|-----------|
| `app/_layout.tsx` | Layout raiz: providers globais (Theme, SafeArea, TankConnection, tRPC, QueryClient) |
| `app/(tabs)/_layout.tsx` | Layout das abas: 4 tabs (Control, Sensors, Chat, Settings) com ícones e cores |
| `app/(tabs)/index.tsx` | **Tela de Controle**: câmera ao vivo, D-pad, modo manual/auto, status de conexão |
| `app/(tabs)/sensors.tsx` | **Tela de Sensores**: barras de distância, indicadores IR, zonas de visão, servo |
| `app/(tabs)/chat.tsx` | **Tela de Chat IA**: interface de mensagens, envio para API de IA do Pi |
| `app/(tabs)/settings.tsx` | **Tela de Configurações**: conexão Pi, info do sistema, controles de áudio |

### 3.3 Componentes Reutilizáveis (components/)

| Arquivo | Descrição |
|---------|-----------|
| `components/screen-container.tsx` | Container com SafeArea para todas as telas |
| `components/haptic-tab.tsx` | Botão de tab com feedback háptico |
| `components/themed-view.tsx` | View com cor de fundo do tema |
| `components/ui/icon-symbol.tsx` | Mapeamento de ícones SF Symbols → Material Icons |

### 3.4 Lógica de Negócio (lib/)

| Arquivo | Descrição |
|---------|-----------|
| `lib/tank-connection.tsx` | **Arquivo central**: Context/Provider para conexão SocketIO com o Pi, gerenciamento de estado de sensores, status e comandos |
| `lib/theme-provider.tsx` | Provider de tema (light/dark) |
| `lib/utils.ts` | Utilitário `cn()` para merge de classes Tailwind |
| `lib/trpc.ts` | Cliente tRPC (para backend Manus, não usado para o Pi) |

### 3.5 Hooks (hooks/)

| Arquivo | Descrição |
|---------|-----------|
| `hooks/use-colors.ts` | Retorna a paleta de cores do tema atual |
| `hooks/use-color-scheme.ts` | Detecta modo claro/escuro do sistema |
| `hooks/use-auth.ts` | Estado de autenticação (não usado neste projeto) |

### 3.6 Assets (assets/)

| Arquivo | Descrição |
|---------|-----------|
| `assets/images/icon.png` | Ícone principal do app (1024x1024) |
| `assets/images/splash-icon.png` | Ícone da splash screen |
| `assets/images/favicon.png` | Favicon para versão web |
| `assets/images/android-icon-foreground.png` | Ícone adaptativo Android (foreground) |

---

## 4. Camada de Comunicação com o Raspberry Pi

Toda a comunicação entre o app e o Raspberry Pi acontece através do arquivo `lib/tank-connection.tsx`, que implementa um React Context com as seguintes responsabilidades.

### 4.1 Conexão SocketIO

O app se conecta ao servidor Flask-SocketIO do Pi usando a biblioteca `socket.io-client`. A conexão é gerenciada por um provider global (`TankConnectionProvider`) que envolve toda a árvore de componentes.

**Configuração da conexão:**

```typescript
const s = io(`http://${piAddress}:${piPort}`, {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  timeout: 10000,
});
```

O endereço IP e porta do Pi são persistidos no AsyncStorage com a chave `tank_pi_address`. O padrão é `192.168.1.215:5000`.

### 4.2 Eventos SocketIO — Enviados pelo App

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `command` | `{ cmd: string }` | Envia comando de movimento ao tanque |
| `set_mode` | `{ mode: string }` | Alterna entre modo "manual" e "auto" |

**Comandos de movimento válidos:**

| Comando | Ação |
|---------|------|
| `F` | Avançar (Forward) |
| `B` | Recuar (Backward) |
| `L` | Virar à esquerda (Left) |
| `R` | Virar à direita (Right) |
| `S` | Parar (Stop) |
| `CL` | Curva à esquerda (Curve Left) |
| `CR` | Curva à direita (Curve Right) |

### 4.3 Eventos SocketIO — Recebidos pelo App

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `status` | `TankStatus` | Estado completo do robô (Arduino OK, câmera OK, modo, motor, visão) |
| `status_update` | `Partial<TankStatus>` | Atualização parcial do status |
| `sensors` | `Partial<SensorData>` | Dados dos sensores (distâncias, IR, servo) |
| `motor` | `{ cmd: string }` | Comando de motor atual |
| `sysinfo` | `SysInfo` | Informações do sistema Pi (CPU, RAM, temp, bateria) |

### 4.4 Interfaces TypeScript

```typescript
interface SensorData {
  df: number;   // Distância frontal (cm) — ultrassônico
  de: number;   // Distância esquerda (cm) — ultrassônico
  dd: number;   // Distância direita (cm) — ultrassônico
  ie: number;   // Sensor IR esquerdo (analógico 0-1023, <500 = obstáculo)
  id: number;   // Sensor IR direito (analógico 0-1023, <500 = obstáculo)
  sv: number;   // Ângulo do servo (60-120 graus)
}

interface VisionData {
  left: number;    // Intensidade de bordas na zona esquerda
  center: number;  // Intensidade de bordas na zona central
  right: number;   // Intensidade de bordas na zona direita
}

interface TankStatus {
  arduino_ok: boolean;     // Arduino conectado e respondendo
  camera_ok: boolean;      // Câmera funcionando
  arduino_port: string;    // Porta serial do Arduino (ex: /dev/ttyUSB0)
  mode: string;            // "manual" ou "auto"
  motor: string;           // Comando de motor atual (F/B/L/R/S)
  vision: VisionData;      // Dados de visão computacional
}

interface SysInfo {
  cpu: number;                                    // Uso de CPU em %
  ram_used: number;                               // RAM usada em MB
  ram_tot: number;                                // RAM total em MB
  ram_pct: number;                                // RAM usada em %
  temp: number;                                   // Temperatura em °C
  gpu_mem: string;                                // Memória GPU
  ip: string;                                     // Endereço IP do Pi
  ard_bat: { pct: number; v: string } | null;     // Bateria do Arduino
  pi_bat: { pct: number; v: string; source: string } | null; // Bateria do Pi
}
```

### 4.5 API REST do Pi

Além do SocketIO, o app faz chamadas HTTP diretas para endpoints REST do servidor Flask.

| Método | Endpoint | Payload | Descrição |
|--------|----------|---------|-----------|
| GET | `/video` | - | Stream MJPEG da câmera (usado como source de Image) |
| POST | `/api/ai/chat` | `{ message, use_vision }` | Chat com IA (OpenAI/Claude) com opção de incluir frame da câmera |
| POST | `/api/audio/volume` | `{ percent: number }` | Ajustar volume do alto-falante do Pi |
| POST | `/api/audio/say` | `{ text: string }` | Text-to-Speech no Pi |
| POST | `/api/audio/test_speaker` | - | Testar alto-falante |
| GET | `/api/audio/volume_get` | - | Obter volume atual |
| POST | `/api/audio/stop` | - | Parar áudio |
| GET | `/api/audio/devices` | - | Listar dispositivos de áudio |
| POST | `/api/audio/play` | `{ file: string }` | Reproduzir arquivo de áudio |
| POST | `/api/ai/stt` | FormData (audio) | Speech-to-Text (Whisper) |
| GET | `/api/voice/status` | - | Status do módulo de voz |
| POST | `/api/voice/map` | `{ commands }` | Atualizar mapeamento de comandos de voz |
| POST | `/api/voice/test` | - | Testar reconhecimento de voz |
| POST | `/api/voice/volume` | `{ level: 1-7 }` | Volume do módulo de voz |
| POST | `/api/voice/mute` | `{ mute: boolean }` | Mutar/desmutar |
| POST | `/api/wifi/status` | - | Status do WiFi |
| POST | `/api/wifi/scan` | - | Escanear redes WiFi |
| POST | `/api/wifi/connect` | `{ ssid, password }` | Conectar a rede WiFi |
| POST | `/api/wifi/disconnect` | - | Desconectar WiFi |
| POST | `/api/arduino/bt/scan` | - | Escanear módulos Bluetooth HC-06 |
| GET | `/state` (porta 8765) | - | Estado atual da face animada |
| POST | `/state` (porta 8765) | `{ state, duration?, note? }` | Alterar estado da face |

**Estados da face animada** (porta 8765): `idle`, `listening`, `thinking`, `happy`, `talking`, `sleepy`, `sleeping`, `yawning`, `surprised`, `confused`.

---

## 5. Detalhamento das Telas

### 5.1 Tela de Controle (`app/(tabs)/index.tsx`)

Esta é a tela principal do app e a primeira que o usuário vê ao abrir. Ela é dividida em três seções verticais.

**Barra de Status** (topo): Exibe o título "Tank Brain", indicadores de conexão (Pi, Câmera, Arduino) como pontos coloridos (verde = OK, vermelho = erro), badge do modo atual (MANUAL em azul ou AUTO em verde) e badge do comando de motor atual (CMD: F/B/L/R/S).

**Feed da Câmera** (centro): Exibe o stream MJPEG da câmera do Pi usando um componente `Image` com a URI `http://{ip}:{port}/video`. Quando desconectado, mostra uma mensagem orientando o usuário a configurar o endereço na aba Settings.

**Controles** (inferior): Contém um D-pad 3x3 com botões direcionais (Forward, Left, Stop, Right, Backward) e uma seção lateral com botão de alternância de modo e informação da porta Arduino. Os botões do D-pad usam `onPressIn` para enviar o comando e `onPressOut` para enviar Stop, implementando controle contínuo por pressão. O botão Stop central tem destaque vermelho. Feedback háptico é acionado em cada pressão.

A tela usa `useKeepAwake()` para manter a tela ligada enquanto o usuário controla o robô.

### 5.2 Tela de Sensores (`app/(tabs)/sensors.tsx`)

Exibe dados dos sensores em tempo real organizados em cards scrolláveis.

**Card de Distância Ultrassônica**: Três barras horizontais para Front (df), Left (de) e Right (dd) com valores em centímetros. As barras são coloridas dinamicamente: verde (>30cm, seguro), amarelo (15-30cm, atenção), vermelho (<15cm, perigo). A largura da barra é proporcional à distância (máximo 200cm = 100%).

**Card de Sensores IR**: Dois boxes lado a lado para IR esquerdo (ie) e IR direito (id). Exibem o valor analógico (0-1023) e mudam para fundo vermelho com texto "OBSTACLE" quando o valor é menor que 500.

**Card de Zonas de Visão**: Três barras verticais para as zonas Left, Center e Right da visão computacional. A altura é proporcional à intensidade de detecção de bordas. Vermelho quando acima do threshold (25), verde quando abaixo.

**Card do Servo**: Exibe o ângulo atual do servo (60-120 graus) com um número grande e um indicador circular sobre uma barra horizontal.

### 5.3 Tela de Chat IA (`app/(tabs)/chat.tsx`)

Interface de chat para interação com o assistente de IA do robô.

**Header**: Mostra o título "AI Assistant" e um badge de status de conexão.

**Lista de Mensagens**: FlatList com mensagens estilizadas por tipo: mensagens do usuário (azul, alinhadas à direita), mensagens da IA (verde, alinhadas à esquerda), mensagens do sistema (cinza, centralizadas) e erros (vermelho, à esquerda). Comandos de movimento extraídos da resposta da IA (formato `[CMD:X]`) são exibidos como chips verdes abaixo da mensagem.

**Toggle de Visão**: Checkbox para incluir ou não o frame da câmera na requisição de IA, permitindo perguntas como "O que você vê?".

**Input**: Campo de texto multiline com botão de envio circular verde. A requisição é feita via POST para `/api/ai/chat` com o texto da mensagem e flag `use_vision`.

### 5.4 Tela de Configurações (`app/(tabs)/settings.tsx`)

Tela scrollável com cards de configuração.

**Card de Conexão Pi**: Campos para IP e porta do Pi, botões Connect/Disconnect, e indicador de status com ponto colorido. Os valores são salvos no AsyncStorage automaticamente.

**Card de Informações do Sistema**: Exibe dados recebidos via SocketIO: CPU (barra de progresso), RAM (barra com usado/total), temperatura (colorida por severidade), memória GPU, endereço IP, e baterias do Arduino e Pi quando disponíveis. Cada métrica usa cores adaptativas: verde (normal), amarelo (atenção), vermelho (crítico).

**Card de Controles de Áudio**: Controle de volume com botões +/- (incrementos de 10%), botão para testar o alto-falante, e campo de texto com botão "Speak" para TTS (Text-to-Speech) no Pi.

**Card Sobre**: Versão do app, nome do robô e versão do firmware Arduino.

---

## 6. Sistema de Temas e Cores

O app usa um tema escuro inspirado em painéis de controle de ficção científica, com acentos em verde neon (#00FF88) que remetem a interfaces de robótica.

### 6.1 Arquivo de Configuração (`theme.config.js`)

Este é o arquivo central de cores. Todos os tokens são definidos aqui e consumidos tanto pelo Tailwind CSS (via `tailwind.config.js`) quanto pelo runtime (via `hooks/use-colors.ts`).

```javascript
const themeColors = {
  primary:    { light: '#00FF88', dark: '#00FF88' },  // Verde neon — acento principal
  background: { light: '#0D1117', dark: '#0D1117' },  // Fundo escuro profundo
  surface:    { light: '#161B22', dark: '#161B22' },  // Cards e painéis
  foreground: { light: '#E6EDF3', dark: '#E6EDF3' },  // Texto principal
  muted:      { light: '#8B949E', dark: '#8B949E' },  // Texto secundário
  border:     { light: '#30363D', dark: '#30363D' },  // Bordas e divisores
  success:    { light: '#00FF88', dark: '#00FF88' },  // Estados positivos
  warning:    { light: '#FFD700', dark: '#FFD700' },  // Alertas e atenção
  error:      { light: '#FF4444', dark: '#FF4444' },  // Erros e perigo
};
```

Para alterar as cores do app, edite apenas este arquivo. As mudanças se propagam automaticamente para todo o app.

### 6.2 Cores Adicionais Usadas Inline

Além dos tokens do tema, algumas cores são usadas diretamente nos StyleSheets para casos específicos:

| Cor | Uso |
|-----|-----|
| `#7AA2F7` | Azul para modo manual e mensagens do usuário |
| `#1A3A2A` | Fundo de elementos verdes (modo auto, mensagens IA) |
| `#1A1A3A` | Fundo de elementos azuis (modo manual, mensagens usuário) |
| `#3D1515` | Fundo de elementos vermelhos (erros, obstáculos) |
| `#2A2A1A` | Fundo do badge de comando (amarelo) |
| `#21262D` | Fundo de elementos neutros (barras, boxes) |
| `#555` | Texto terciário muito discreto |

---

## 7. Navegação

O app usa Expo Router 6 com navegação por abas (Tab Navigator). A configuração está em `app/(tabs)/_layout.tsx`.

| Tab | Ícone SF Symbol | Ícone Material | Arquivo |
|-----|----------------|----------------|---------|
| Control | `gamecontroller.fill` | `sports-esports` | `index.tsx` |
| Sensors | `gauge` | `speed` | `sensors.tsx` |
| Chat | `bubble.left.fill` | `chat` | `chat.tsx` |
| Settings | `gearshape.fill` | `settings` | `settings.tsx` |

O mapeamento de ícones está em `components/ui/icon-symbol.tsx`. Para adicionar novos ícones, é obrigatório adicionar o mapeamento neste arquivo antes de usá-lo em qualquer tab ou componente.

---

## 8. Conexão com o Raspberry Pi

### 8.1 Dados de Acesso ao Pi

| Parâmetro | Valor |
|-----------|-------|
| IP | 192.168.1.215 |
| Usuário SSH | oper |
| Senha SSH | 123456 |
| Porta do servidor Tank | 5000 |
| Porta do servidor Face | 8765 |

### 8.2 Arquivos do Servidor no Pi

O servidor Flask roda em `/home/oper/tank/tank_server.py`. Os principais arquivos no Pi são:

| Caminho no Pi | Descrição |
|---------------|-----------|
| `/home/oper/tank/tank_server.py` | Servidor principal Flask + SocketIO |
| `/home/oper/tank/templates/index.html` | Interface web original (referência) |
| `/home/oper/tank/ai_config.json` | Configuração de IA (chaves API, provider) |
| `/home/oper/tank/requirements.txt` | Dependências Python |
| `/home/oper/tank/venv/` | Ambiente virtual Python |
| `/home/oper/chatbot_face/` | App da face animada (Pygame + HTTP) |
| `/home/oper/arduino/tank_v6_pi_slave/` | Sketch Arduino |

### 8.3 Como Iniciar o Servidor no Pi

```bash
ssh oper@192.168.1.215  # senha: 123456
cd /home/oper/tank
source venv/bin/activate
python tank_server.py
```

O servidor inicia na porta 5000 e fica acessível em `http://192.168.1.215:5000`.

---

## 9. Guia de Manutenção e Ajustes Futuros

### 9.1 Alterar Cores do Tema

Edite o arquivo `theme.config.js` na raiz do projeto. As cores são definidas como pares light/dark (neste projeto ambos são iguais pois o tema é sempre escuro). Após editar, o Metro bundler recarrega automaticamente.

### 9.2 Adicionar uma Nova Tela

Para adicionar uma nova tela ao app, siga estes passos na ordem indicada.

Primeiro, crie o arquivo da tela em `app/(tabs)/nova-tela.tsx` seguindo o padrão das telas existentes, usando `ScreenContainer` como wrapper. Segundo, adicione o mapeamento do ícone em `components/ui/icon-symbol.tsx` no objeto `MAPPING`. Terceiro, adicione a tab em `app/(tabs)/_layout.tsx` como um novo `Tabs.Screen`.

### 9.3 Adicionar um Novo Comando de Motor

Para adicionar um novo comando (ex: "Spin"), edite os seguintes locais. No app, adicione um novo `Pressable` no D-pad da tela de controle (`app/(tabs)/index.tsx`) que chame `sendCommand("SPIN")`. No Pi, adicione o tratamento do comando no `tank_server.py` na função que processa o evento `command`.

### 9.4 Adicionar um Novo Sensor

Para exibir um novo sensor, siga estes passos. Primeiro, adicione o campo na interface `SensorData` em `lib/tank-connection.tsx`. Segundo, adicione o valor padrão no objeto `defaultSensors`. Terceiro, crie o componente visual na tela de sensores (`app/(tabs)/sensors.tsx`). No lado do Pi, certifique-se de que o servidor emite o novo campo no evento `sensors`.

### 9.5 Alterar o IP Padrão do Pi

O IP padrão está definido como constante em `lib/tank-connection.tsx`:

```typescript
const DEFAULT_IP = "192.168.1.215";
const DEFAULT_PORT = "5000";
```

O usuário também pode alterar o IP diretamente na tela de Settings, e o valor é persistido no AsyncStorage.

### 9.6 Adicionar Controle de WiFi/Bluetooth

Os endpoints já existem no servidor Pi (`/api/wifi/*` e `/api/arduino/bt/*`). Para implementar no app, crie novos cards na tela de Settings com campos de input para SSID/senha e botões para scan/connect/disconnect, fazendo chamadas fetch para os endpoints correspondentes.

### 9.7 Adicionar Controle de Voz no App

O Pi já suporta STT (Speech-to-Text) via `/api/ai/stt`. Para implementar no app, use a biblioteca `expo-audio` para gravar áudio do microfone do celular, envie o arquivo via FormData para o endpoint STT, e use a resposta como texto de entrada no chat.

### 9.8 Adicionar Controle da Face Animada

O servidor da face roda na porta 8765 do Pi. Para controlar a face pelo app, faça requisições HTTP para `http://{ip}:8765/state` com o estado desejado. Os estados disponíveis são: `idle`, `listening`, `thinking`, `happy`, `talking`, `sleepy`, `sleeping`, `yawning`, `surprised`, `confused`.

---

## 10. Dependências Principais

### 10.1 Dependências do App

| Pacote | Versão | Uso |
|--------|--------|-----|
| `expo` | ~54.0.29 | Framework principal |
| `react-native` | 0.81.5 | Runtime nativo |
| `expo-router` | ~6.0.19 | Navegação baseada em arquivos |
| `nativewind` | ^4.2.1 | Tailwind CSS para React Native |
| `socket.io-client` | ^4.x | Comunicação SocketIO com o Pi |
| `@react-native-async-storage/async-storage` | ^2.2.0 | Persistência local (IP do Pi) |
| `expo-haptics` | ~15.0.8 | Feedback tátil nos controles |
| `expo-keep-awake` | ~15.0.8 | Manter tela ligada durante controle |
| `react-native-reanimated` | ~4.1.6 | Animações performáticas |
| `react-native-gesture-handler` | ~2.28.0 | Gestos nativos |
| `react-native-safe-area-context` | ~5.6.2 | SafeArea para notch/home indicator |

### 10.2 Dependências do Pi (requirements.txt)

| Pacote | Uso |
|--------|-----|
| `flask` | Servidor web |
| `flask-socketio` | WebSocket bidirecional |
| `opencv-python` | Visão computacional |
| `picamera2` | Interface da câmera Pi |
| `pyserial` | Comunicação serial com Arduino |
| `openai` | API de IA (chat, visão) |
| `anthropic` | API Claude (alternativa) |
| `pyttsx3` | Text-to-Speech local |
| `psutil` | Monitoramento do sistema |
| `pybluez` | Comunicação Bluetooth |

---

## 11. Scripts de Desenvolvimento

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Inicia servidor de desenvolvimento (Metro + API) |
| `pnpm dev:metro` | Inicia apenas o Metro bundler |
| `pnpm dev:server` | Inicia apenas o servidor API |
| `pnpm check` | Verificação de tipos TypeScript |
| `pnpm lint` | Linting com ESLint |
| `pnpm test` | Testes com Vitest |
| `pnpm android` | Inicia no emulador Android |
| `pnpm ios` | Inicia no simulador iOS |
| `pnpm qr` | Gera QR code para Expo Go |

Para testar no celular, instale o app **Expo Go** e escaneie o QR code gerado pelo Metro bundler.

---

## 12. Troubleshooting

### Problema: App não conecta ao Pi

Verifique se o celular e o Pi estão na mesma rede WiFi. Confirme que o servidor Flask está rodando (`python tank_server.py`). Teste acessando `http://192.168.1.215:5000` no navegador do celular. Se funcionar no navegador mas não no app, verifique se o IP está correto na tela de Settings.

### Problema: Câmera não aparece

O stream MJPEG (`/video`) pode não funcionar diretamente no componente `Image` do React Native em todas as plataformas. Se necessário, considere usar um `WebView` apontando para a URL do stream, ou implementar polling de frames JPEG individuais.

### Problema: Comandos não respondem

Verifique o status do Arduino na barra de status (ponto "Ard"). Se estiver vermelho, o Arduino pode estar desconectado do Pi. Verifique a conexão USB ou Bluetooth HC-06. No Pi, verifique a porta serial com `ls /dev/ttyUSB*` ou `ls /dev/ttyACM*`.

### Problema: IA não responde

Verifique o arquivo `ai_config.json` no Pi para confirmar que as chaves de API (OpenAI ou Claude) estão configuradas. O endpoint `/api/ai/chat` retorna `{ ok: false, error: "..." }` em caso de falha.

### Problema: Sensores mostram valores fixos

Se os sensores mostram sempre 999 (distância) ou 1023 (IR), significa que o Arduino não está enviando dados. Verifique a conexão serial e o sketch Arduino. Os valores padrão são definidos em `defaultSensors` no `tank-connection.tsx`.

---

## 13. Fluxo de Dados Completo

Para ilustrar como os dados fluem pelo sistema, considere o fluxo de um comando de movimento.

O usuário pressiona o botão Forward no D-pad. O componente `Pressable` dispara `onPressIn`, que chama `handlePressIn("F")`. Esta função aciona feedback háptico via `expo-haptics` e chama `sendCommand("F")` do context. O `sendCommand` emite o evento SocketIO `command` com payload `{ cmd: "F" }`. O servidor Flask no Pi recebe o evento, envia o comando serial `F` para o Arduino, que ativa os motores. O Pi emite de volta o evento `motor` com `{ cmd: "F" }`, que atualiza o estado `status.motor` no context. A UI reflete o novo comando no badge "CMD: F".

Quando o usuário solta o botão, `onPressOut` dispara e envia `sendCommand("S")` (Stop), repetindo o fluxo para parar os motores.

---

## 14. Considerações de Segurança

O app se comunica com o Pi via HTTP e WebSocket sem criptografia (não HTTPS). Isso é aceitável para uso em rede local doméstica, mas não deve ser exposto à internet. As credenciais SSH do Pi (oper/123456) são fracas e devem ser alteradas se o Pi for acessível fora da rede local. As chaves de API de IA (OpenAI/Claude) ficam armazenadas no Pi no arquivo `ai_config.json` e não são expostas pelo app.

---

## 15. Possíveis Melhorias Futuras

Abaixo estão sugestões de funcionalidades que podem ser implementadas para expandir o projeto.

**Gravação de Rotas**: Implementar um sistema que grave a sequência de comandos de movimento e permita reproduzi-la automaticamente, criando "rotas" que o tanque pode seguir.

**Mapa de Obstáculos**: Usar os dados dos sensores ultrassônicos para construir um mapa 2D simples do ambiente ao redor do robô, exibido na tela de sensores.

**Controle por Giroscópio**: Usar o acelerômetro/giroscópio do celular (via `expo-sensors`) para controlar o tanque inclinando o dispositivo, como um volante.

**Notificações Push**: Enviar notificações quando o robô detectar obstáculos, bateria baixa ou perder conexão, usando `expo-notifications`.

**Modo Paisagem para Controle**: Adicionar suporte a orientação landscape na tela de controle para uma experiência mais imersiva com câmera em tela cheia.

**Galeria de Fotos**: Capturar snapshots da câmera e salvá-los no dispositivo usando `expo-media-library`.

**Perfis de Velocidade**: Permitir ajustar a velocidade dos motores (lento/médio/rápido) enviando comandos de PWM para o Arduino.
