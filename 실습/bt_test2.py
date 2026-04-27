import bluetooth

target_address = "98:DA:60:11:22:76"
port = 1

def receive_message(sock):
    buffer = ""  # Buffer to accumulate data
    try:
        while True:
            data = sock.recv(1024).decode()
            if data:
                buffer += data
                if '\n' in data:
                    messages =  buffer.split('\n')
                    print("Received data:", messages[0])
                    break;

    except Exception as e:
        print("Failed to receive message:", e)

    return messages[0]

def send_message(sock, message):
    try:
        sock.send(message.encode('utf-8'))
        print("Sent:", message)
    except Exception as e:
        print("Failed to send message:", e)
        

def main():
    nearby_devices = bluetooth.discover_devices(duration=8, lookup_names=True, flush_cache=True)
    
    if target_address not in [addr for addr, _ in nearby_devices]:
        print("Cannot Search target device")
        return
    
    print("Target device searched successfully")
    
    sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
    sock.connect((target_address, port))
    print("Bluetooth connection succeeded")
    
    try:
        while True:
            print("ready for receive")
            message = receive_message(sock)
            send_message(sock, message)

    except Exception as e:
        print("Error:", e)
    finally:
        sock.close()

if __name__ == "__main__":
    main()

