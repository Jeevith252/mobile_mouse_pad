import { useState, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput,
  TouchableOpacity, PanResponder, StatusBar, Alert
} from 'react-native';

export default function App() {
  const [ip, setIp] = useState('192.168.22.200');
  const [port, setPort] = useState('5000');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const socketRef = useRef<WebSocket | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const tapTimer = useRef<any>(null);
  const tapCount = useRef(0);
  const hasMoved = useRef(false);
  const twoFingerY = useRef<number | null>(null);
  const moveThreshold = 3;

  // ── Connect to server ──
  const connect = () => {
    try {
      const ws = new WebSocket(`ws://${ip}:${port}`);

      ws.onopen = () => {
        setConnected(true);
        setStatus('Connected ✓');
        // Heartbeat ping every 15 seconds
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          } else {
            clearInterval(pingInterval);
          }
        }, 15000);
        (ws as any)._pingInterval = pingInterval;
      };

      ws.onerror = () => {
        setStatus('Connection failed ✗');
        Alert.alert('Error', 'Could not connect.\nCheck IP and server.');
      };

      ws.onclose = () => {
  setConnected(false);
  setStatus('Reconnecting...');
  if ((socketRef.current as any)?._pingInterval) {
    clearInterval((socketRef.current as any)._pingInterval);
  }
  // Auto reconnect after 2 seconds
  setTimeout(() => {
    console.log('[*] Attempting reconnect...');
    connect();
  }, 2000);
};

      socketRef.current = ws;
    } catch (e: any) {
      setStatus('Error: ' + e.message);
    }
  };

  const disconnect = () => {
    if ((socketRef.current as any)?._pingInterval) {
      clearInterval((socketRef.current as any)._pingInterval);
    }
    socketRef.current?.close();
    setConnected(false);
    setStatus('Not connected');
  };

  const send = (event: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    }
  };

  // ── Touchpad: 1 finger = move, 2 fingers = scroll ──
  const touchpadResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (e) => {
      hasMoved.current = false;
      if (e.nativeEvent.touches.length === 1) {
        lastPos.current = {
          x: e.nativeEvent.pageX,
          y: e.nativeEvent.pageY,
        };
      }
    },

    onPanResponderMove: (e) => {
      const touches = e.nativeEvent.touches;

      // ── Two fingers = scroll ──
      if (touches.length === 2) {
        lastPos.current = null;
        const currentY = (touches[0].pageY + touches[1].pageY) / 2;
        if (twoFingerY.current !== null) {
          const dy = currentY - twoFingerY.current;
          const delta = Math.round(-dy / 6);
          if (delta !== 0) {
            send({ type: 'scroll', dy: delta });
          }
        }
        twoFingerY.current = currentY;
        return;
      }

      // ── One finger = move cursor ──
      if (touches.length === 1) {
        twoFingerY.current = null;
        if (!lastPos.current) {
          lastPos.current = {
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          };
          return;
        }
        const dx = e.nativeEvent.pageX - lastPos.current.x;
        const dy = e.nativeEvent.pageY - lastPos.current.y;

        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
          hasMoved.current = true;
          lastPos.current = {
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          };
          send({ type: 'move', dx, dy });
        }
      }
    },

    onPanResponderRelease: (e) => {
      twoFingerY.current = null;
      lastPos.current = null;

      // Tap = click
      if (!hasMoved.current && e.nativeEvent.touches.length === 0) {
        tapCount.current += 1;
        if (tapCount.current === 1) {
          tapTimer.current = setTimeout(() => {
            if (tapCount.current === 1) {
              send({ type: 'left_click' });
            }
            tapCount.current = 0;
          }, 250);
        } else if (tapCount.current === 2) {
          clearTimeout(tapTimer.current);
          send({ type: 'double_click' });
          tapCount.current = 0;
        }
      }
      hasMoved.current = false;
    },

    onPanResponderTerminate: () => {
      lastPos.current = null;
      twoFingerY.current = null;
      hasMoved.current = false;
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>📱 Mobile Touchpad</Text>
        <View style={[styles.badge,
          { backgroundColor: connected ? '#1a3a1a' : '#3a1a1a' }]}>
          <Text style={[styles.badgeText,
            { color: connected ? '#4caf50' : '#f44336' }]}>
            {status}
          </Text>
        </View>
      </View>

      {/* ── Setup Screen ── */}
      {!connected && (
        <View style={styles.setupBox}>
          <Text style={styles.setupTitle}>Connect to Desktop</Text>
          <Text style={styles.label}>Desktop IP Address</Text>
          <TextInput
            style={styles.input}
            value={ip}
            onChangeText={setIp}
            keyboardType="numeric"
            placeholder="192.168.x.x"
            placeholderTextColor="#555"
          />
          <Text style={styles.label}>Port</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="numeric"
            placeholderTextColor="#555"
          />
          <TouchableOpacity style={styles.connectBtn} onPress={connect}>
            <Text style={styles.connectBtnText}>🔌 Connect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Touchpad Screen ── */}
      {connected && (
        <>
          {/* Instructions */}
          <View style={styles.infoBar}>
            <Text style={styles.infoText}>
              1 finger = move  ·  2 fingers = scroll
            </Text>
            <Text style={styles.infoText}>
              Tap = click  ·  Double tap = double click
            </Text>
          </View>

          {/* Touchpad Area */}
          <View
            style={styles.touchpad}
            {...touchpadResponder.panHandlers}>
            <Text style={styles.touchpadHint}>Touchpad</Text>
          </View>

          {/* Click Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => send({ type: 'left_click' })}>
              <Text style={styles.btnText}>◀ Left</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => send({ type: 'double_click' })}>
              <Text style={styles.btnText}>◀◀ Double</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnRight]}
              onPress={() => send({ type: 'right_click' })}>
              <Text style={styles.btnText}>Right ▶</Text>
            </TouchableOpacity>
          </View>

          {/* Drag Button */}
          <DragButton send={send} />

          {/* Disconnect */}
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={disconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ── Drag Button Component ──
function DragButton({ send }: { send: (e: object) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.dragBtn, dragging && styles.dragBtnActive]}
      onPress={() => {
        if (!dragging) {
          send({ type: 'drag_start' });
          setDragging(true);
        } else {
          send({ type: 'drag_end' });
          setDragging(false);
        }
      }}>
      <Text style={styles.dragBtnText}>
        {dragging ? '🔒 Dragging — tap to release' : '✋ Hold Drag'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    padding: 16,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  infoBar: {
    backgroundColor: '#161b22',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  infoText: { color: '#8b949e', fontSize: 12, marginBottom: 2 },
  setupBox: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    padding: 24,
    borderWidth: 0.5,
    borderColor: '#30363d',
  },
  setupTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: { color: '#8b949e', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0d1117',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#30363d',
    fontSize: 15,
  },
  connectBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  connectBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  touchpad: {
    flex: 1,
    backgroundColor: '#161b22',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  touchpadHint: { color: '#484f58', fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btn: {
    flex: 1,
    backgroundColor: '#21262d',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#30363d',
  },
  btnRight: { backgroundColor: '#2d1f1f' },
  btnText: { color: '#cdd9e5', fontSize: 13, fontWeight: '500' },
  dragBtn: {
    backgroundColor: '#21262d',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#30363d',
    marginBottom: 12,
  },
  dragBtnActive: {
    backgroundColor: '#1a3a1a',
    borderColor: '#4caf50',
  },
  dragBtnText: { color: '#cdd9e5', fontSize: 13, fontWeight: '500' },
  disconnectBtn: {
    backgroundColor: '#2d1f1f',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#f4433633',
    marginBottom: 12,
  },
  disconnectText: { color: '#f44336', fontSize: 14, fontWeight: '500' },
});