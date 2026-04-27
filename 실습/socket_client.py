import socket
import time
import random

def client_program():
    host = '192.168.0.124'
    port = 10020
    
    while True:
        try:
            print("Attempting to connect to the server...", host, ":",port)

            # Establish a new connection on each loop iteration
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.connect((host, port))
            print("Connection established.")

            # Send a random number
            number = random.randint(1, 100)
            message = str(number)+'\n'
            client_socket.send(message.encode('utf-8'))
            print(f"Sent: {message}")
            
            # Wait for a response from the server
            response = client_socket.recv(1024).decode('utf-8')
            print(f"Received: {response}")
            
            # Send a disconnect message and close the socket
            client_socket.send("[disconnect]".encode('utf-8'))
            client_socket.close()
            print("Disconnected from the server.")
            
            # Wait for 3 seconds before the next loop iteration
            time.sleep(3)
        
        except Exception as e:
            print(f"An error occurred: {e}")
            break  # Exit the loop if an error occurs

if __name__ == '__main__':
    client_program()

