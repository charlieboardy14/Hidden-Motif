import { GameState, Player, Artwork, Vote, RoundData, ServerGameState } from '../types.cjs';
import { TOTAL_ROUNDS, TOTAL_PLAYERS, GALLERY_TIMER_SECONDS } from '../constants.cjs';
import * as gemini from './services/geminiService.cjs';

const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

export class Game {
  roomId: string;
  players: Player[] = [];
  state: GameState = GameState.LOBBY;
  currentRound = 0;
  roundData: RoundData | null = null;
  artworks: Artwork[] = [];
  votes: Vote[] = [];
  galleryIndex = 0;
  galleryTimer: NodeJS.Timeout | null = null;
  galleryTime = GALLERY_TIMER_SECONDS;
  dodgerId: string | null = null;
  
  private readyPlayers = new Set<string>();
  private broadcastUpdate: () => void;

  constructor(roomId: string, broadcastUpdate: () => void) {
    this.roomId = roomId;
    this.broadcastUpdate = broadcastUpdate;
  }

  addPlayer(id: string, name: string) {
    if (this.players.length >= TOTAL_PLAYERS) return;
    this.players.push({ id, name, score: 0, role: 'Artist', promptSubmitted: false });
  }

  removePlayer(id: string) {
    this.players = this.players.filter(p => p.id !== id);
    if(this.players.length === 0) {
        if(this.galleryTimer) clearInterval(this.galleryTimer);
    }
  }
  
  isFull() {
      return this.players.length >= TOTAL_PLAYERS;
  }

  startGame() {
    if (this.state !== GameState.LOBBY) return;
    this.currentRound = 1;
    this.players.forEach(p => p.score = 0);
    this.startNewRound();
  }
  
  resetGame() {
      this.state = GameState.LOBBY;
      this.currentRound = 0;
      this.players.forEach(p => p.score = 0);
      this.broadcastUpdate();
  }

  async startNewRound() {
    this.state = GameState.ROUND_STARTING;
    this.broadcastUpdate();

    this.roundData = await gemini.generateRoundData();
    this.artworks = [];
    this.votes = [];
    this.galleryIndex = 0;
    this.readyPlayers.clear();
    
    // Reset roles and assign a new dodger
    this.players.forEach(p => {
        p.role = 'Artist';
        p.promptSubmitted = false;
    });
    const dodgerIndex = Math.floor(Math.random() * this.players.length);
    this.players[dodgerIndex].role = 'Dodger';
    this.dodgerId = this.players[dodgerIndex].id;

    this.state = GameState.BRIEFING;
    this.broadcastUpdate();
  }
  
  handlePlayerReady(playerId: string) {
      this.readyPlayers.add(playerId);
      if(this.readyPlayers.size === this.players.length) {
          this.state = GameState.PROMPTING;
          this.broadcastUpdate();
      }
  }

  handlePromptSubmission(playerId: string, prompt: string) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.promptSubmitted) return;

    player.promptSubmitted = true;
    
    const isDodger = player.role === 'Dodger';
    // Artwork ID is just a number for the round
    const artworkId = this.artworks.length + 1;
    this.artworks.push({ id: artworkId, playerId, prompt, imageUrl: null, isDodger });
    
    this.broadcastUpdate();

    if (this.players.every(p => p.promptSubmitted)) {
      this.generateAllArtworks();
    }
  }

  async generateAllArtworks() {
      this.state = GameState.GENERATING;
      this.broadcastUpdate();
      
      const generationPromises = this.artworks.map(async (art) => {
          const imageUrl = await gemini.generateImage(art.prompt);
          art.imageUrl = imageUrl;
      });
      
      await Promise.all(generationPromises);
      this.artworks = shuffleArray(this.artworks);
      
      this.state = GameState.GALLERY;
      this.broadcastUpdate();
      this.startGalleryTimer();
  }
  
  startGalleryTimer() {
      if(this.galleryTimer) clearInterval(this.galleryTimer);
      this.galleryTime = GALLERY_TIMER_SECONDS;
      
      this.galleryTimer = setInterval(() => {
          this.galleryTime--;
          if(this.galleryTime <= 0) {
              this.nextGalleryItem();
          }
          this.broadcastUpdate();
      }, 1000);
  }
  
  nextGalleryItem() {
      if(this.galleryTimer) clearInterval(this.galleryTimer);
      
      // Players who didn't vote are considered to have voted 'NO'
      const currentArtworkId = this.artworks[this.galleryIndex].id;
      this.players.forEach(p => {
          const hasVoted = this.votes.some(v => v.voterId === p.id && v.artworkId === currentArtworkId);
          if(!hasVoted) {
              this.votes.push({ voterId: p.id, artworkId: currentArtworkId, isYes: false });
          }
      });

      if (this.galleryIndex < this.artworks.length - 1) {
          this.galleryIndex++;
          this.startGalleryTimer();
      } else {
          this.runArtEvaluation();
      }
  }

  handleVote(voterId: string, isYes: boolean) {
      const artworkId = this.artworks[this.galleryIndex].id;
      // Prevent double voting
      if(this.votes.some(v => v.voterId === voterId && v.artworkId === artworkId)) return;
      
      this.votes.push({ voterId, artworkId, isYes });
      
      const allVotedForThisArt = this.players.every(p => 
        this.votes.some(v => v.voterId === p.id && v.artworkId === artworkId)
      );
      
      if(allVotedForThisArt) {
          this.nextGalleryItem();
      }
      this.broadcastUpdate();
  }

  async runArtEvaluation() {
      this.state = GameState.SCORING;
      this.broadcastUpdate();
      if(!this.roundData) return;
      
      const rankings = await gemini.evaluateArtworks(this.artworks, this.roundData.theme);
      this.calculateScores(rankings);
      
      this.state = GameState.REVEAL;
      this.broadcastUpdate();
  }
  
  calculateScores(rankings: { qualityRanking: number[], originalityRanking: number[] }) {
    const { qualityRanking, originalityRanking } = rankings;
    const dodgerArtwork = this.artworks.find(art => art.isDodger);
    if (!dodgerArtwork) return;

    let dodgerPoints = 0;
    this.votes.forEach(vote => {
        const votedArtwork = this.artworks.find(art => art.id === vote.artworkId);
        if (vote.isYes && votedArtwork && !votedArtwork.isDodger) {
            dodgerPoints++;
        }
    });

    const scoreMap = new Map<number, { quality: number; originality: number }>();
    this.artworks.forEach(art => scoreMap.set(art.id, { quality: 0, originality: 0 }));

    const pointsByRank = [3, 2, 1];
    qualityRanking.forEach((artworkId, index) => {
        if (index < pointsByRank.length) {
            const currentScore = scoreMap.get(artworkId);
            if (currentScore) currentScore.quality = pointsByRank[index];
        }
    });
    originalityRanking.forEach((artworkId, index) => {
        if (index < pointsByRank.length) {
            const currentScore = scoreMap.get(artworkId);
            if (currentScore) currentScore.originality = pointsByRank[index];
        }
    });

    this.players.forEach(p => {
        let scoreToAdd = 0;
        const correctVote = this.votes.find(v => v.voterId === p.id && v.artworkId === dodgerArtwork.id)?.isYes;
        if(correctVote) scoreToAdd++;
        
        if (p.role === 'Dodger') scoreToAdd += dodgerPoints;
        
        const playerArtwork = this.artworks.find(art => art.playerId === p.id);
        if (playerArtwork) {
            const bonus = scoreMap.get(playerArtwork.id);
            if(bonus) scoreToAdd += bonus.quality + bonus.originality;
        }
        p.score += scoreToAdd;
    });

    this.artworks.forEach(art => {
        const bonus = scoreMap.get(art.id);
        art.qualityScore = bonus?.quality ?? 0;
        art.originalityScore = bonus?.originality ?? 0;
    });
  }

  nextRound() {
      if(this.state !== GameState.REVEAL) return;
      
      if(this.currentRound < TOTAL_ROUNDS) {
          this.currentRound++;
          this.startNewRound();
      } else {
          this.state = GameState.GAME_OVER;
          this.broadcastUpdate();
      }
  }


  getSerializableState(): ServerGameState {
    return {
      state: this.state,
      players: this.players,
      currentRound: this.currentRound,
      roundData: this.roundData,
      artworks: this.artworks,
      votes: this.votes,
      galleryIndex: this.galleryIndex,
      galleryTime: this.galleryTime,
      roundPoints: this.votes.filter(v => v.isYes && !this.artworks.find(a => a.id === v.artworkId)?.isDodger).length,
      dodgerId: this.dodgerId,
    };
  }
}
