import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Game } from './game.cjs';

const app = express();
app.use(cors()); // Allow requests from the frontend URL

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your frontend's domain
    methods: ["GET", "POST"]
  }
});

const games = new Map<string, Game>();

const generateRoomId = (): string => {
    let id = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 4; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure the ID is unique
    if (games.has(id)) {
        return generateRoomId();
    }
    return id;
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  const broadcastUpdate = (roomId: string) => {
    const game = games.get(roomId);
    if (game) {
      io.to(roomId).emit('gameStateUpdate', game.getSerializableState());
    }
  };

  socket.on('createGame', ({ name }, callback) => {
    const roomId = generateRoomId();
    const game = new Game(roomId, () => broadcastUpdate(roomId));
    games.set(roomId, game);
    
    socket.join(roomId);
    game.addPlayer(socket.id, name);
    
    console.log(`Game created with ID: ${roomId} by ${name}`);
    callback(roomId); // Send the new room ID back to the client
    broadcastUpdate(roomId);
  });

  socket.on('joinGame', ({ name, roomId }, callback) => {
    const game = games.get(roomId);
    if (game && !game.isFull()) {
      socket.join(roomId);
      game.addPlayer(socket.id, name);
      console.log(`${name} joined game ${roomId}`);
      callback(roomId);
      broadcastUpdate(roomId);
    } else {
      socket.emit('gameError', 'Game not found or is full.');
      callback(null);
    }
  });
  
  const getGame = () => {
      // Find which room the socket is in
      const room = [...socket.rooms].find(r => r !== socket.id);
      return room ? games.get(room) : null;
  }

  socket.on('startGame', () => {
    const game = getGame();
    if (game && game.players[0].id === socket.id) { // Only host can start
      game.startGame();
    }
  });
  
  socket.on('playerReady', () => {
      const game = getGame();
      if(game) game.handlePlayerReady(socket.id);
  })

  socket.on('submitPrompt', (prompt: string) => {
    const game = getGame();
    if (game) {
      game.handlePromptSubmission(socket.id, prompt);
    }
  });
  
  socket.on('castVote', (isYes: boolean) => {
      const game = getGame();
      if(game) {
          game.handleVote(socket.id, isYes);
      }
  });
  
  socket.on('nextRound', () => {
      const game = getGame();
      if(game) game.nextRound();
  });

  socket.on('playAgain', () => {
      const game = getGame();
      if (game && game.players[0].id === socket.id) { // Only host can restart
          game.resetGame();
      }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const game = getGame();
    if (game) {
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
            games.delete(game.roomId);
            console.log(`Game room ${game.roomId} closed.`);
        } else {
            broadcastUpdate(game.roomId);
        }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
