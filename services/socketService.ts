import { io, Socket } from 'socket.io-client';

// Use localhost for development. In production, this would be your server's URL.
const SERVER_URL = 'https://hidden-motif.onrender.com/'; 

export let socket: Socket;

export const connect = () => {
  if (socket) return;
  socket = io(SERVER_URL);
};

export const disconnect = () => {
  if (socket) {
    socket.disconnect();
  }
};
