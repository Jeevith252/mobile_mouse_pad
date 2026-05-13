import asyncio
import websockets
import json
import pyautogui

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0

SENSITIVITY = 1.8
ACCELERATION = 1.5

def apply_acceleration(delta):
    import math
    sign = 1 if delta >= 0 else -1
    magnitude = abs(delta)
    accelerated = magnitude * (1 + (magnitude / 10) ** ACCELERATION)
    return sign * accelerated * SENSITIVITY

def process_event(event):
    etype = event.get('type')
    if etype == 'move':
        dx = apply_acceleration(event.get('dx', 0))
        dy = apply_acceleration(event.get('dy', 0))
        pyautogui.moveRel(int(dx), int(dy), duration=0)
    elif etype == 'left_click':
        pyautogui.click()
    elif etype == 'right_click':
        pyautogui.rightClick()
    elif etype == 'double_click':
        pyautogui.doubleClick()
    elif etype == 'scroll':
        amount = event.get('dy', 0)
        pyautogui.scroll(int(-amount * 15))
    elif etype == 'drag_start':
        pyautogui.mouseDown()
    elif etype == 'drag_end':
        pyautogui.mouseUp()
    elif etype == 'key':
        pyautogui.typewrite(event.get('key', ''), interval=0.02)
    elif etype == 'hotkey':
        pyautogui.hotkey(*event.get('keys', []))

async def handle_client(websocket):
    client = websocket.remote_address
    print(f"[+] Connected: {client}")
    try:
        async for message in websocket:
            try:
                event = json.loads(message)
                # ignore ping messages
                if event.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
                    continue
                process_event(event)
            except json.JSONDecodeError:
                print(f"[-] Bad message: {message}")
    except websockets.exceptions.ConnectionClosed as e:
        print(f"[-] Disconnected: {client} — {e}")

async def main():
    print("[*] Mobile Touchpad Server starting...")
    print("[*] Listening on ws://0.0.0.0:5000")
    print("[*] Press Ctrl+C to stop\n")
    async with websockets.serve(
        handle_client,
        "0.0.0.0",
        5000,
        ping_interval=20,
        ping_timeout=60,
        close_timeout=10,
    ):
        await asyncio.Future()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[*] Server stopped.")