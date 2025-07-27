
import React, { useState, useEffect } from 'react';
import { GameState, Player, Artwork, Vote, RoundData, PlayerRole, ServerGameState } from './types';
import { TOTAL_ROUNDS, TOTAL_PLAYERS, GALLERY_TIMER_SECONDS } from './constants';
import { socket, connect, disconnect } from './services/socketService';

// --- UI COMPONENTS (Largely unchanged, but props are now from server state) ---

const Spinner: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex flex-col items-center justify-center text-center">
    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-400 mb-4"></div>
    <p className="text-xl font-semibold text-gray-300">{text}</p>
  </div>
);

const GameTitle: React.FC = () => (
    <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-4">
      <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-purple-500">
        Hidden Motif
      </span>
    </h1>
);

interface JoinScreenProps {
  onJoin: (name: string, roomId: string) => void;
  onCreate: (name: string) => void;
  error: string | null;
}

const JoinScreen: React.FC<JoinScreenProps> = ({ onJoin, onCreate, error }) => {
    const [name, setName] = useState('');
    const [roomId, setRoomId] = useState('');

    return (
        <div className="flex flex-col items-center justify-center h-full text-center w-full max-w-sm">
            <GameTitle />
            <p className="text-lg text-gray-400 mb-8">Join a game or create a new one to play with friends.</p>
            <input
                type="text"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full p-3 mb-4 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="w-full">
                <button
                    onClick={() => onCreate(name)}
                    disabled={!name.trim()}
                    className="w-full px-8 py-4 mb-4 bg-teal-500 text-white font-bold rounded-lg shadow-lg hover:bg-teal-600 disabled:bg-gray-600 transition-transform transform hover:scale-105"
                >
                    Create New Game
                </button>
            </div>
            <div className="w-full flex items-center my-4">
                <hr className="flex-grow border-t border-gray-600"/>
                <span className="px-4 text-gray-400">OR</span>
                <hr className="flex-grow border-t border-gray-600"/>
            </div>
            <input
                type="text"
                value={roomId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter Room Code"
                maxLength={4}
                className="w-full p-3 mb-4 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
                onClick={() => onJoin(name, roomId)}
                disabled={!name.trim() || !roomId.trim()}
                className="w-full px-8 py-4 bg-purple-600 text-white font-bold rounded-lg shadow-lg hover:bg-purple-700 disabled:bg-gray-600 transition-transform transform hover:scale-105"
            >
                Join Game
            </button>
            {error && <p className="text-red-500 text-center mt-4 font-semibold">{error}</p>}
        </div>
    );
};

interface LobbyScreenProps {
  players: Player[];
  roomId: string;
  isHost: boolean;
  onStart: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ players, roomId, isHost, onStart }) => (
  <div className="w-full max-w-lg mx-auto p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 text-center">
    <h2 className="text-3xl font-bold text-teal-400 mb-2">Game Lobby</h2>
    <p className="text-gray-400 mb-4">Share this code with your friends:</p>
    <div className="bg-gray-900 font-mono text-4xl tracking-widest p-3 rounded-lg text-purple-400 mb-6">{roomId}</div>
    <h3 className="text-xl font-semibold mb-4 text-gray-300">Players ({players.length}/{TOTAL_PLAYERS})</h3>
    <div className="space-y-2 mb-8">
      {players.map(p => (
        <div key={p.id} className="bg-gray-700 p-3 rounded-lg text-lg text-white">{p.name} {p.id === socket.id ? '(You)' : ''}</div>
      ))}
    </div>
    {isHost ? (
      <button
        onClick={onStart}
        className="w-full px-8 py-4 bg-teal-500 text-white font-bold rounded-lg shadow-lg hover:bg-teal-600 transition-transform transform hover:scale-105"
      >
        Start Game
      </button>
    ) : (
      <p className="text-gray-400">Waiting for the host to start the game...</p>
    )}
  </div>
);

interface BriefingScreenProps {
  round: number;
  role: PlayerRole;
  data: RoundData;
  onContinue: () => void;
}

const BriefingScreen: React.FC<BriefingScreenProps> = ({ round, role, data, onContinue }) => (
  <div className="w-full max-w-4xl mx-auto p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
    <h2 className="text-3xl font-bold text-center text-teal-400 mb-2">Round {round} / {TOTAL_ROUNDS}</h2>
    <p className="text-center text-gray-400 mb-6">Your Role:</p>
    <div className="text-center mb-8">
      <span className={`px-6 py-3 text-4xl font-black rounded-lg ${role === 'Dodger' ? 'bg-purple-600 text-white' : 'bg-blue-500 text-white'}`}>
        {role}
      </span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
      <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-400 mb-2">Theme</h3>
        <p className="text-2xl font-bold text-white">{data.theme}</p>
      </div>
      <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-400 mb-2">Secret Motif 1</h3>
        <p className="text-2xl font-bold text-white">{data.motif1}</p>
      </div>
      <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-400 mb-2">Secret Motif 2</h3>
        <p className="text-2xl font-bold text-white">{data.motif2}</p>
      </div>
    </div>
    
    <div className="mt-8 text-center bg-gray-900/50 p-4 rounded-lg">
      <h4 className="font-bold text-lg mb-2">{role === 'Dodger' ? 'Your Mission:' : 'Your Mission:'}</h4>
      <p className="text-gray-300">
        {role === 'Dodger' 
          ? `Subtly include both "${data.motif1}" and "${data.motif2}" in your artwork based on the theme.`
          : `Create artwork based on the theme, but be very careful NOT to include anything that looks like "${data.motif1}" or "${data.motif2}".`
        }
      </p>
    </div>

    <div className="mt-8 text-center">
      <button onClick={onContinue} className="px-8 py-3 bg-teal-500 text-white font-bold rounded-lg shadow-lg hover:bg-teal-600 transition-transform transform hover:scale-105">
        I'm Ready!
      </button>
    </div>
  </div>
);

interface PromptingScreenProps {
  roundData: RoundData;
  onSubmit: (prompt: string) => void;
  isDodger: boolean;
  players: Player[];
}

const PromptingScreen: React.FC<PromptingScreenProps> = ({ roundData, onSubmit, isDodger, players }) => {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const MAX_CHARS = 100;

  const handleSubmit = () => {
    setError('');
    if (isDodger) {
      const motif1Included = prompt.toLowerCase().includes(roundData.motif1.toLowerCase());
      const motif2Included = prompt.toLowerCase().includes(roundData.motif2.toLowerCase());
      if (!motif1Included || !motif2Included) {
        setError('As the Dodger, your prompt must include both secret motifs!');
        return;
      }
    }
    onSubmit(prompt);
  };

  const me = players.find(p => p.id === socket.id);
  if (me?.promptSubmitted) {
      return (
          <div className="w-full max-w-3xl mx-auto p-6 text-center">
              <Spinner text="Waiting for other players to submit their prompts..."/>
              <div className="mt-8">
                  {players.map(p => (
                      <div key={p.id} className="flex items-center justify-center gap-2 text-lg">
                          <span>{p.name} {p.id === socket.id ? '(You)' : ''}</span>
                          {p.promptSubmitted ? <span className="text-green-400">✔</span> : <span className="text-gray-500">...</span>}
                      </div>
                  ))}
              </div>
          </div>
      )
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
      <h2 className="text-2xl font-bold text-center mb-4">Create Your Artwork Prompt</h2>
      <div className="bg-gray-700 p-4 rounded-lg mb-4 text-center">
        <p className="text-gray-400">Theme: <span className="font-bold text-white">{roundData.theme}</span></p>
        <p className="text-gray-400">Remember to {isDodger ? 'INCLUDE' : 'AVOID'}: <span className="font-bold text-white">{roundData.motif1} & {roundData.motif2}</span></p>
      </div>
      <textarea
        value={prompt}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
        placeholder="e.g., An epic fantasy landscape..."
        maxLength={MAX_CHARS}
        rows={3}
        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
      />
       <div className={`text-right text-sm mt-1 ${prompt.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
        {prompt.length} / {MAX_CHARS}
      </div>
      {error && <p className="text-red-500 text-center mt-2 font-semibold">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={!prompt.trim()}
        className="mt-4 w-full px-8 py-4 bg-purple-600 text-white font-bold rounded-lg shadow-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:transform-none"
      >
        Submit Prompt
      </button>
    </div>
  );
};

interface GalleryScreenProps {
  artwork: Artwork;
  onVote: (isYes: boolean) => void;
  time: number;
  imageIndex: number;
  totalImages: number;
}

const GalleryScreen: React.FC<GalleryScreenProps> = ({ artwork, onVote, time, imageIndex, totalImages }) => {
  const timerPercentage = (time / GALLERY_TIMER_SECONDS) * 100;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-2">Is this the Dodger's artwork?</h2>
      <p className="text-gray-400 mb-4">Artwork {imageIndex + 1} of {totalImages}</p>
      
      <div className="relative w-full aspect-video bg-gray-800 rounded-lg shadow-2xl overflow-hidden border-2 border-gray-700 mb-4">
        {artwork.imageUrl ? (
          <img src={`data:image/jpeg;base64,${artwork.imageUrl}`} alt="Generated artwork" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">Artwork failed to generate.</div>
        )}
        <div className="absolute bottom-0 left-0 h-2 bg-teal-500 transition-all duration-1000 linear" style={{ width: `${timerPercentage}%` }}></div>
      </div>

      <div className="flex gap-4">
        <button onClick={() => onVote(true)} className="px-12 py-4 bg-green-600 text-white font-bold text-2xl rounded-lg shadow-lg hover:bg-green-700 transition-transform transform hover:scale-105">YES</button>
        <button onClick={() => onVote(false)} className="px-12 py-4 bg-red-600 text-white font-bold text-2xl rounded-lg shadow-lg hover:bg-red-700 transition-transform transform hover:scale-105">NO</button>
      </div>
    </div>
  );
};

interface RevealScreenProps {
  artworks: Artwork[];
  votes: Vote[];
  players: Player[];
  onNextRound: () => void;
  roundPoints: number;
  dodgerId: string | null;
  userVoteResult?: { correct: boolean, votedYes: boolean };
}

const RevealScreen: React.FC<RevealScreenProps> = ({ artworks, votes, players, onNextRound, roundPoints, dodgerId }) => {
    const me = players.find((p: Player) => p.id === socket.id);
    const dodgerPlayer = players.find((p: Player) => p.id === dodgerId);
    
    const userCorrectlyIdentifiedDodger = votes.some((v: Vote) => v.voterId === me?.id && artworks.find((a: Artwork) => a.id === v.artworkId)?.isDodger && v.isYes);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <h2 className="text-4xl font-bold text-center mb-6">Round Reveal</h2>
      
      <div className="p-4 bg-gray-800 rounded-lg mb-6 text-center shadow-lg">
          <h3 className="text-2xl font-bold mb-2">Round Score</h3>
          <p className="text-lg">
              {userCorrectlyIdentifiedDodger ? "You correctly identified the Dodger! +1 Point" : "You did not find the Dodger."}
          </p>
          <p className="text-lg">{dodgerPlayer?.name ?? 'The Dodger'} earned {roundPoints} points from false accusations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artworks.map((art: Artwork) => {
          const vote = votes.find((v: Vote) => v.voterId === me?.id && v.artworkId === art.id);
          const player = players.find((p: Player) => p.id === art.playerId);
          return (
            <div key={art.id} className={`relative bg-gray-800 rounded-lg shadow-lg overflow-hidden border-4 ${art.isDodger ? 'border-purple-500' : 'border-gray-700'}`}>
              {art.isDodger && <div className="absolute top-2 right-2 px-3 py-1 bg-purple-600 text-white font-bold rounded-full z-10">DODGER</div>}
              <div className="aspect-video bg-gray-900">
                {art.imageUrl && <img src={`data:image/jpeg;base64,${art.imageUrl}`} alt={art.prompt} className="w-full h-full object-cover"/>}
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-400 mb-2 italic h-12 overflow-y-auto">"{art.prompt}"</p>
                <div className="flex justify-between items-center text-sm mb-2">
                  <p className="font-semibold">{player?.id === socket.id ? 'Your Artwork' : player?.name}</p>
                  <div className={`px-2 py-1 rounded font-bold ${art.isDodger ? 'text-purple-400' : 'text-blue-400'}`}>{art.isDodger ? 'Dodger' : 'Artist'}</div>
                </div>
                 <div className="text-xs text-center border-t border-gray-700 pt-2 space-y-2">
                  <div className="flex justify-around">
                    <span className="text-yellow-400 font-bold">Quality: +{art.qualityScore ?? 0}</span>
                    <span className="text-cyan-400 font-bold">Originality: +{art.originalityScore ?? 0}</span>
                  </div>
                </div>
              </div>
              {vote !== undefined && (
                <div className={`absolute inset-0 bg-black/70 flex items-center justify-center`}>
                    <div className="text-center">
                        <p className="text-lg text-gray-300">You voted:</p>
                        <p className={`text-5xl font-black ${vote.isYes ? 'text-green-500' : 'text-red-500'}`}>{vote.isYes ? 'YES' : 'NO'}</p>
                        {vote.isYes === art.isDodger ? <p className="text-green-400 font-bold mt-2">CORRECT</p> : <p className="text-red-400 font-bold mt-2">INCORRECT</p>}
                    </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center mt-8">
        <button onClick={onNextRound} className="px-8 py-4 bg-teal-500 text-white font-bold rounded-lg shadow-lg hover:bg-teal-600 transition-transform transform hover:scale-105">
          Continue
        </button>
      </div>
    </div>
  );
};

interface GameEndScreenProps {
  players: Player[];
  onPlayAgain: () => void;
}

const GameEndScreen: React.FC<GameEndScreenProps> = ({ players, onPlayAgain }) => {
  const sortedPlayers = [...players].sort((a: Player, b: Player) => b.score - a.score);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 text-center">
        <h2 className="text-4xl font-bold mb-6">Final Scores</h2>
        <div className="space-y-3">
            {sortedPlayers.map((p: Player, index: number) => (
                <div key={p.id} className={`flex justify-between items-center p-3 rounded-lg ${p.id === socket.id ? 'bg-teal-500/30 border-2 border-teal-500' : 'bg-gray-700'}`}>
                    <span className="font-bold text-lg">{index + 1}. {p.id === socket.id ? 'You' : p.name}</span>
                    <span className="font-black text-xl">{p.score} Points</span>
                </div>
            ))}
        </div>
        <button onClick={onPlayAgain} className="mt-8 px-8 py-4 bg-teal-500 text-white font-bold rounded-lg shadow-lg hover:bg-teal-600 transition-transform transform hover:scale-105">
          Play Again
        </button>
    </div>
  );
}

// --- MAIN APP COMPONENT ---

export default function App() {
  const [game, setGame] = useState<ServerGameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    connect();
    
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('gameStateUpdate', (newState: ServerGameState) => {
        setGame(newState);
        setError(null);
    });
    socket.on('gameError', (errorMessage: string) => setError(errorMessage));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameStateUpdate');
      socket.off('gameError');
      disconnect();
    };
  }, []);
  
  const me = game?.players.find(p => p.id === socket.id);

  const handleCreateGame = (name: string) => {
    socket.emit('createGame', { name }, (newRoomId: string) => {
      setRoomId(newRoomId);
    });
  };

  const handleJoinGame = (name: string, roomIdToJoin: string) => {
     if (!roomIdToJoin) {
         setError("Please enter a room code.");
         return;
     }
    socket.emit('joinGame', { name, roomId: roomIdToJoin }, (joinedRoomId: string | null) => {
        if(joinedRoomId) {
            setRoomId(joinedRoomId);
        }
    });
  };

  const handleStartGame = () => socket.emit('startGame');
  const handleReady = () => socket.emit('playerReady');
  const handleSubmitPrompt = (prompt: string) => socket.emit('submitPrompt', prompt);
  const handleVote = (isYes: boolean) => socket.emit('castVote', isYes);
  const handleNextRound = () => socket.emit('nextRound');
  const handlePlayAgain = () => socket.emit('playAgain');


  const renderContent = () => {
      if (!isConnected) {
          return <Spinner text="Connecting to server..." />;
      }
      
      if (!game || game.state === GameState.JOIN) {
          return <JoinScreen onCreate={handleCreateGame} onJoin={handleJoinGame} error={error} />;
      }
      
      const isHost = game.players[0]?.id === socket.id;

      switch (game.state) {
        case GameState.LOBBY:
            return <LobbyScreen players={game.players} roomId={roomId!} isHost={isHost} onStart={handleStartGame} />;
        case GameState.ROUND_STARTING:
            return <Spinner text="Dreaming up a new round..."/>;
        case GameState.BRIEFING:
            return game.roundData && me ? <BriefingScreen round={game.currentRound} role={me.role} data={game.roundData} onContinue={handleReady} /> : <Spinner text="Loading briefing..."/>;
        case GameState.PROMPTING:
            return game.roundData && me ? <PromptingScreen roundData={game.roundData} onSubmit={handleSubmitPrompt} isDodger={me.role === 'Dodger'} players={game.players} /> : <Spinner text="Loading..."/>;
        case GameState.GENERATING:
            return <Spinner text="The AI artists are hard at work..."/>;
        case GameState.SCORING:
            return <Spinner text="AI critic is evaluating the artworks..."/>;
        case GameState.GALLERY:
            const currentArtwork = game.artworks[game.galleryIndex];
            return currentArtwork ? <GalleryScreen artwork={currentArtwork} onVote={handleVote} time={game.galleryTime} imageIndex={game.galleryIndex} totalImages={game.artworks.length} /> : <Spinner text="Loading Gallery..." />;
        case GameState.REVEAL:
            return <RevealScreen artworks={game.artworks} votes={game.votes} players={game.players} onNextRound={handleNextRound} roundPoints={game.roundPoints} dodgerId={game.dodgerId ?? null} />;
        case GameState.GAME_OVER:
            return <GameEndScreen players={game.players} onPlayAgain={handlePlayAgain} />;
        default:
            return <JoinScreen onCreate={handleCreateGame} onJoin={handleJoinGame} error={error}/>;
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4">
      {renderContent()}
    </main>
  );
}