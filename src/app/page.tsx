'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, DollarSign, Users, Trophy, Clock, CheckCircle, XCircle, Settings, Mail } from 'lucide-react';

type Outcome = 'MADE' | 'MISSED';
type GameMode = 'solo' | 'multiplayer';
type GameStatus = 'betting' | 'revealing' | 'completed';

interface Video {
  id: number;
  outcome: Outcome;
}

interface User {
  name: string;
  email: string;
  balance: number;
}

interface Player {
  name: string;
  amount: number;
  prediction: Outcome;
  isUser?: boolean;
}

interface GameState {
  mode: GameMode;
  video: Video;
  status: GameStatus;
  betPlaced: boolean;
  outcome?: Outcome;
  won?: boolean | null;
  payout?: number;
  userBet?: {
    amount: number;
    prediction: Outcome;
  };
  totalPot?: number;
  botsLoaded?: boolean;
}

interface GameHistoryEntry {
  mode: GameMode;
  bet: number;
  prediction: Outcome;
  outcome: Outcome;
  won: boolean;
  payout: number;
  timestamp: Date;
}

export default function App() {
  const DEMO_VIDEOS: Video[] = [
    { id: 1, outcome: 'MADE' },
    { id: 2, outcome: 'MISSED' },
    { id: 3, outcome: 'MADE' },
    { id: 4, outcome: 'MISSED' },
  ];

  const [currentView, setCurrentView] = useState<string>('home');
  const [user, setUser] = useState<User>({ name: 'Demo Player', email: 'demo@hoopshot.com', balance: 1000 });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [betAmount, setBetAmount] = useState<number>(50);
  const [prediction, setPrediction] = useState<Outcome | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>([]);
  const [multiplayerLobby, setMultiplayerLobby] = useState<Player[]>([]);
  const [userExitedManually, setUserExitedManually] = useState<boolean>(false);
  const multiplayerRestartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Защита от двойного вызова reveal
const revealCalledRef = useRef<boolean>(false);

// Для безопасного чтения актуального gameState в асинхронных колбэках
const gameStateRef = useRef<typeof gameState | null>(null);
useEffect(() => {
  gameStateRef.current = gameState;
}, [gameState]);


  const formatBalance = (balance: number): string => {
    return balance.toFixed(2);
  };

useEffect(() => {
  if (timeLeft === null || timeLeft <= 0) return;
  if (!gameState || gameState.status !== 'betting') return;

  const timer = setInterval(() => {
    setTimeLeft(prev => {
      if (prev === null) return null;
      if (prev <= 1) {
        clearInterval(timer);
        // Вызываем reveal один раз (референс + проверка в revealOutcome дополнительно)
        revealOutcome();
        return null;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [timeLeft, gameState?.status]);


  useEffect(() => {
    if (currentView === 'multiplayer' && gameState?.mode === 'multiplayer' && multiplayerLobby.length === 0 && !gameState.botsLoaded) {
      const botNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
      const numberOfBots = Math.floor(Math.random() * 7) + 4;
      
      const initialBots: Player[] = [];
      const usedNames = new Set<string>();
      
      for (let i = 0; i < numberOfBots; i++) {
        let name: string;
        do {
          name = botNames[Math.floor(Math.random() * botNames.length)];
        } while (usedNames.has(name));
        usedNames.add(name);
        
        initialBots.push({
          name,
          amount: Math.floor(Math.random() * 150) + 20,
          prediction: Math.random() > 0.5 ? 'MADE' : 'MISSED'
        });
      }
      
      setGameState(prev => prev ? { ...prev, botsLoaded: true } : prev);
      
      initialBots.forEach((bot, index) => {
        const delay = Math.random() * 3000 + (index * 500);
        setTimeout(() => {
          setMultiplayerLobby(prev => [...prev, bot]);
          setGameState(prev => prev ? {
            ...prev,
            totalPot: (prev.totalPot || 0) + bot.amount
          } : prev);
        }, delay);
      });
    }
  }, [currentView, gameState?.mode, multiplayerLobby.length, gameState?.botsLoaded]);

  useEffect(() => {
    return () => {
      if (multiplayerRestartTimeoutRef.current) {
        clearTimeout(multiplayerRestartTimeoutRef.current);
      }
    };
  }, []);

  const startSoloGame = () => {
    const video = DEMO_VIDEOS[Math.floor(Math.random() * DEMO_VIDEOS.length)];
    setGameState({
      mode: 'solo',
      video,
      status: 'betting',
      betPlaced: false
    });
    setTimeLeft(15);
    setPrediction(null);
    setCurrentView('game');
  };

  const startMultiplayerGame = () => {
    const video = DEMO_VIDEOS[Math.floor(Math.random() * DEMO_VIDEOS.length)];
    setGameState({
      mode: 'multiplayer',
      video,
      status: 'betting',
      betPlaced: false,
      totalPot: 0,
      botsLoaded: false
    });
    setTimeLeft(20);
    setPrediction(null);
    setMultiplayerLobby([]);
    setUserExitedManually(false);
    setCurrentView('multiplayer');
  };

const placeBet = () => {
  if (!prediction || betAmount <= 0 || !gameState) return;

  // снимаем ставку один раз
  setUser(prev => ({ ...prev, balance: Number(prev.balance) - Number(betAmount) }));

  // ставим флаг betPlaced и сохраняем ставку игрока
  setGameState(prev => prev ? ({
    ...prev,
    betPlaced: true,
    userBet: { amount: betAmount, prediction }
  }) : prev);

  // мультиплеерная логика — добавляем в лобби и увеличиваем totalPot
  if (gameState?.mode === 'multiplayer') {
    setMultiplayerLobby(prev => [...prev, {
      name: user.name,
      amount: betAmount,
      prediction,
      isUser: true
    }]);

    setGameState(prev => prev ? ({
      ...prev,
      totalPot: (prev.totalPot || 0) + betAmount
    }) : prev);
  }
};


const revealOutcome = () => {
  // защита: если уже обрабатывается или нет gameState — игнорируем
  if (revealCalledRef.current) return;
  const gs = gameStateRef.current;
  if (!gs || gs.status !== 'betting') return;

  // ставим флаг, чтобы второй вызов был проигнорирован
  revealCalledRef.current = true;

  // переводим статус в "revealing"
  setGameState(prev => prev ? ({ ...prev, status: 'revealing' }) : prev);

  // Снимок локальных значений (чтобы избежать stale closures)
  const localMode = gs.mode;
  const localBetPlaced = !!gs.betPlaced;
  const localVideoOutcome = gs.video?.outcome ?? DEMO_VIDEOS[Math.floor(Math.random() * DEMO_VIDEOS.length)].outcome;
  const localPrediction = prediction;
  const localBetAmount = betAmount;
  const localLobby = multiplayerLobby.slice(); // локальная копия лобби

  setTimeout(() => {
    try {
      // Если ставки не было — завершаем без выплат
      if (!localBetPlaced) {
        setGameState(prev => prev ? ({
          ...prev,
          status: 'completed',
          outcome: localVideoOutcome,
          won: null,
          payout: 0
        }) : prev);

        // мультиплеер: рестарт по таймауту, если нужно
        if (localMode === 'multiplayer' && !userExitedManually) {
          multiplayerRestartTimeoutRef.current = setTimeout(() => {
            if (currentView === 'multiplayer' && !userExitedManually) {
              startMultiplayerGame();
            }
          }, 5000);
        }

        return;
      }

      // Вычисляем результат
      const won = localPrediction === localVideoOutcome;
      let payout = 0;

      if (localMode === 'solo' && won) {
        // ставка уже списана при placeBet => выплачиваем 2x от ставки (ставка + выигрыш)
        payout = Number(localBetAmount) * 2;
      } else if (localMode === 'multiplayer') {
        const totalPot = localLobby.reduce((sum, p) => sum + Number(p.amount), 0);
        const winners = localLobby.filter(p => p.prediction === localVideoOutcome);
        const winnerBets = winners.reduce((sum, p) => sum + Number(p.amount), 0);

        if (winnerBets > 0 && won) {
          const commission = totalPot * 0.1; // 10%
          const netPot = totalPot - commission;
          // ПРАВИЛЬНАЯ формула: выигрыш = (твоя ставка / все ставки победителей) * netPot
          payout = (Number(localBetAmount) / winnerBets) * netPot;
        } else {
          payout = 0;
        }
      }

      // Выплата делаем ровно один раз
      if (payout > 0) {
        setUser(prev => ({ ...prev, balance: Number(prev.balance) + Number(payout) }));
      }

      // Обновляем состояние игры итоговыми данными
      setGameState(prev => prev ? ({
        ...prev,
        status: 'completed',
        outcome: localVideoOutcome,
        won,
        payout,
        betPlaced: false
      }) : prev);

      // Добавляем в историю (защита от дублей по таймштампу)
      setGameHistory(prev => {
        const newEntry = {
          mode: localMode,
          bet: localBetAmount,
          prediction: localPrediction!,
          outcome: localVideoOutcome,
          won,
          payout,
          timestamp: new Date()
        };
        const isDuplicate = prev.some(entry =>
          Math.abs(entry.timestamp.getTime() - newEntry.timestamp.getTime()) < 1000 &&
          entry.bet === newEntry.bet &&
          entry.prediction === newEntry.prediction
        );
        if (isDuplicate) return prev;
        return [newEntry, ...prev].slice(0, 10);
      });

      // мультиплеер рестарт, если нужен
      if (localMode === 'multiplayer' && !userExitedManually) {
        multiplayerRestartTimeoutRef.current = setTimeout(() => {
          if (currentView === 'multiplayer' && !userExitedManually) {
            startMultiplayerGame();
          }
        }, 5000);
      }
    } finally {
      // снимаем флаг чтобы разрешить следующий раунд
      revealCalledRef.current = false;
    }
  }, 2000);
};


  const restartSoloGame = () => {
    const video = DEMO_VIDEOS[Math.floor(Math.random() * DEMO_VIDEOS.length)];
    setGameState({
      mode: 'solo',
      video,
      status: 'betting',
      betPlaced: false
    });
    setTimeLeft(15);
    setPrediction(null);
  };

  const resetGame = () => {
    setUserExitedManually(true);
    if (multiplayerRestartTimeoutRef.current) {
      clearTimeout(multiplayerRestartTimeoutRef.current);
    }
    setGameState(null);
    setCurrentView('home');
    setPrediction(null);
    setTimeLeft(null);
  };

const calculatePotentialWin = (playerBet: number, playerPrediction: Outcome): number => {
  if (!multiplayerLobby.length) return 0;

  const totalPot = multiplayerLobby.reduce((sum, p) => sum + p.amount, 0);
  const samePrediction = multiplayerLobby.filter(p => p.prediction === playerPrediction);
  const winnerBets = samePrediction.reduce((sum, p) => sum + p.amount, 0);

  if (winnerBets === 0) return 0;

  const commission = totalPot * 0.1;
  const netPot = totalPot - commission;

  return (playerBet / winnerBets) * netPot;
};
  interface NavBarProps {
    showExit?: boolean;
  }
  

  const NavBar: React.FC<NavBarProps> = ({ showExit = false }) => (
    <nav className="bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {showExit ? (
            <button 
              onClick={resetGame}
              className="text-white/80 hover:text-white transition"
            >
              ← Exit
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center">
                <Trophy className="text-white" size={20} />
              </div>
              <span className="text-2xl font-bold text-white">HoopShot</span>
            </div>
          )}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <DollarSign size={18} className="text-green-400" />
              <span className="text-white font-semibold">${formatBalance(user.balance)}</span>
            </div>
            <button
              onClick={() => {
                setUserExitedManually(true);
                if (multiplayerRestartTimeoutRef.current) {
                  clearTimeout(multiplayerRestartTimeoutRef.current);
                }
                setCurrentView('profile');
              }}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                {user.name.charAt(0)}
              </div>
              <span className="text-white text-sm">{user.name}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  if (currentView === 'profile') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <NavBar showExit={true}/>

        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 mb-8">
            <div className="flex items-center gap-6 mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-4xl text-white font-bold">
                {user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">{user.name}</h2>
                <div className="flex items-center gap-2 text-white/60">
                  <Mail size={16} />
                  <span>{user.email}</span>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/5 rounded-2xl p-6">
                <div className="text-white/60 mb-2">Current Balance</div>
                <div className="text-4xl font-bold text-green-400">
                  ${formatBalance(user.balance)}
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-6">
                <div className="text-white/60 mb-2">Total Games</div>
                <div className="text-4xl font-bold text-white">
                  {gameHistory.length}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Settings size={20} />
                Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/60 mb-2">Display Name</label>
                  <input
                    type="text"
                    value={user.name}
                    onChange={(e) => setUser(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-2">Email</label>
                  <input
                    type="email"
                    value={user.email}
                    onChange={(e) => setUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Game History</h3>
            
            {gameHistory.length === 0 ? (
              <div className="text-center py-12">
                <Trophy size={48} className="text-white/30 mx-auto mb-4" />
                <p className="text-white/60 text-lg">No games played yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gameHistory.map((game, idx) => (
                  <div key={idx} className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          game.won ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {game.won ? <CheckCircle size={20} className="text-green-400" /> : <XCircle size={20} className="text-red-400" />}
                        </div>
                        <div>
                          <div className="text-white font-semibold capitalize">{game.mode} Mode</div>
                          <div className="text-white/60 text-sm">
                            {game.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-bold ${game.won ? 'text-green-400' : 'text-red-400'}`}>
                          {game.won ? `+$${formatBalance(game.payout - game.bet)}` : `-$${formatBalance(game.bet)}`}
                        </div>
                        <div className="text-white/60 text-sm">
                          {game.prediction} → {game.outcome}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <NavBar />

        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h1 className="text-7xl font-bold text-white mb-6">
              Will It Go In? 🏀
            </h1>
            <p className="text-2xl text-white/70 mb-4">
              Watch. Predict. Win.
            </p>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              AI-generated basketball shots. Make your prediction before the reveal. 
              Double your money in Solo or compete with others in Multiplayer!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="group relative bg-gradient-to-br from-orange-500/20 to-pink-500/20 backdrop-blur-sm border border-white/20 rounded-3xl p-8 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/50">
              <div className="absolute -top-4 -right-4 bg-gradient-to-br from-orange-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                Quick Play
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <Play size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Solo Mode</h2>
                  <p className="text-white/60">You vs The Shot</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-white/80">
                  <CheckCircle size={20} className="text-green-400" />
                  Win 2x your bet
                </li>
                <li className="flex items-center gap-3 text-white/80">
                  <CheckCircle size={20} className="text-green-400" />
                  Instant results
                </li>
                <li className="flex items-center gap-3 text-white/80">
                  <CheckCircle size={20} className="text-green-400" />
                  15 seconds to decide
                </li>
              </ul>
              <button 
                onClick={startSoloGame}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-orange-500/50 transition-all"
              >
                Start Solo Game
              </button>
            </div>

            <div className="group relative bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-white/20 rounded-3xl p-8 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/50">
              <div className="absolute -top-4 -right-4 bg-gradient-to-br from-blue-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                Multiplayer
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                  <Users size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">Multiplayer</h2>
                  <p className="text-white/60">Players vs Players</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-white/80">
                  <CheckCircle size={20} className="text-blue-400" />
                  Win big pot
                </li>
                <li className="flex items-center gap-3 text-white/80">
                  <CheckCircle size={20} className="text-blue-400" />
                  Play with others
                </li>
                <li className="flex items-center gap-3 text-white/80">
                  <CheckCircle size={20} className="text-blue-400" />
                  20 seconds betting time
                </li>
              </ul>
              <button 
                onClick={startMultiplayerGame}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all"
              >
                Join Multiplayer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto mt-16">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
              <div className="text-4xl font-bold text-white mb-2">98%</div>
              <div className="text-white/60">Uptime</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
              <div className="text-4xl font-bold text-white mb-2">$50K+</div>
              <div className="text-white/60">Total Pot</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center">
              <div className="text-4xl font-bold text-white mb-2">2.5K+</div>
              <div className="text-white/60">Players</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'game' && gameState?.mode === 'solo') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <NavBar showExit={true} />

        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="relative bg-black rounded-3xl overflow-hidden mb-8 shadow-2xl">
            <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
              {gameState.status === 'completed' ? (
                <div className="text-center">
                  <div className={`w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center ${
                    gameState.outcome === 'MADE' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    <div className="text-6xl">
                      {gameState.outcome === 'MADE' ? '✓' : '✗'}
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-white mb-2">
                    Shot {gameState.outcome === 'MADE' ? 'Made!' : 'Missed!'}
                  </div>
                  {gameState.won === null ? (
                    <div className="text-xl text-white/60">
                      No bet placed - Just watching! 👀
                    </div>
                  ) : (
                    <div className={`text-2xl font-semibold ${gameState.won ? 'text-green-400' : 'text-red-400'}`}>
                      {gameState.won ? `You Won $${formatBalance((gameState.payout || 0) - betAmount)}! 🎉` : `You Lost $${formatBalance(betAmount)} 😞`}
                    </div>
                  )}
                </div>
              ) : gameState.status === 'revealing' ? (
                <div className="text-center">
                  <div className="w-24 h-24 border-8 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
                  <div className="text-white text-2xl font-semibold">Ball is in the air...</div>
                  <div className="text-white/60 mt-2">🏀 Revealing result...</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-24 h-24 border-8 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
                  <div className="text-white text-2xl font-semibold">Loading Shot...</div>
                  <div className="text-white/60 mt-2">AI generating unique basketball shot</div>
                </div>
              )}
            </div>
            {timeLeft !== null && timeLeft > 0 && (
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                <div className="flex items-center gap-2 text-white">
                  <Clock size={18} />
                  <span className="font-bold">{timeLeft}s</span>
                </div>
              </div>
            )}
          </div>

          {!gameState.betPlaced && gameState.status === 'betting' && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">
                Make Your Prediction
              </h2>
              
              <div className="mb-6">
                <label className="block text-white/80 mb-3 text-lg">Bet Amount</label>
                <input
                  type="range"
                  min="10"
                  max={Math.min(500, user.balance)}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-white/60">$10</span>
                  <span className="text-3xl font-bold text-white">${betAmount}</span>
                  <span className="text-white/60">${Math.min(500, user.balance)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setPrediction('MADE')}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    prediction === 'MADE'
                      ? 'bg-green-500/30 border-green-400 scale-105'
                      : 'bg-white/5 border-white/20 hover:border-green-400/50'
                  }`}
                >
                  <div className="text-5xl mb-3">🏀</div>
                  <div className="text-xl font-bold text-white">Shot Goes In</div>
                  <div className="text-white/60 mt-1">Win 2x</div>
                </button>

                <button
                  onClick={() => setPrediction('MISSED')}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    prediction === 'MISSED'
                      ? 'bg-red-500/30 border-red-400 scale-105'
                      : 'bg-white/5 border-white/20 hover:border-red-400/50'
                  }`}
                >
                  <div className="text-5xl mb-3">❌</div>
                  <div className="text-xl font-bold text-white">Shot Misses</div>
                  <div className="text-white/60 mt-1">Win 2x</div>
                </button>
              </div>

              <button
                onClick={placeBet}
                disabled={!prediction}
                className={`w-full py-5 rounded-2xl font-bold text-xl transition-all ${
                  prediction
                    ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:shadow-lg hover:shadow-orange-500/50'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                Place Bet - ${betAmount}
              </button>
            </div>
          )}

          {gameState.betPlaced && gameState.status === 'betting' && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 text-center">
              <div className="text-white/80 text-lg mb-4">Your bet is placed!</div>
              <div className="text-white text-3xl font-bold mb-2">
                ${betAmount} on {prediction === 'MADE' ? '🏀 Shot Goes In' : '❌ Shot Misses'}
              </div>
              <div className="text-white/60">Waiting for reveal...</div>
            </div>
          )}

          {gameState.status === 'completed' && (
            <button
              onClick={restartSoloGame}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-5 rounded-2xl font-bold text-xl hover:shadow-lg transition-all"
            >
              Play Again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'multiplayer' && gameState?.mode === 'multiplayer') {
    const totalPot = multiplayerLobby.reduce((sum, p) => sum + p.amount, 0);
    const madeCount = multiplayerLobby.filter(p => p.prediction === 'MADE').length;
    const missedCount = multiplayerLobby.filter(p => p.prediction === 'MISSED').length;
    const sortedLobby = [...multiplayerLobby].sort((a, b) => b.amount - a.amount);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <nav className="bg-black/30 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button 
              onClick={resetGame}
              className="text-white/80 hover:text-white transition"
            >
              ← Exit
            </button>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-400" />
                <span className="text-white font-semibold">{multiplayerLobby.length} Players</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <DollarSign size={18} className="text-green-400" />
                <span className="text-white font-semibold">${formatBalance(user.balance)}</span>
              </div>
              <button
                onClick={() => {
                  setUserExitedManually(true);
                  if (multiplayerRestartTimeoutRef.current) {
                    clearTimeout(multiplayerRestartTimeoutRef.current);
                  }
                  setCurrentView('profile');
                }}
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                  {user.name.charAt(0)}
                </div>
                <span className="text-white text-sm">{user.name}</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="relative bg-black rounded-3xl overflow-hidden mb-8 shadow-2xl">
                <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                  {gameState.status === 'completed' ? (
                    <div className="text-center">
                      <div className={`w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center ${
                        gameState.outcome === 'MADE' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        <div className="text-6xl">
                          {gameState.outcome === 'MADE' ? '✓' : '✗'}
                        </div>
                      </div>
                      <div className="text-4xl font-bold text-white mb-2">
                        Shot {gameState.outcome === 'MADE' ? 'Made!' : 'Missed!'}
                      </div>
                      {gameState.won === null ? (
                        <div className="text-xl text-white/60">
                          No bet placed - Just watching! 👀
                        </div>
                      ) : (
                        <div className={`text-2xl font-semibold ${gameState.won ? 'text-green-400' : 'text-red-400'}`}>
                          {gameState.won ? `You Won ${formatBalance((gameState.payout || 0) - betAmount)}! 🎉` : `You Lost ${formatBalance(betAmount)} 😞`}
                        </div>
                      )}
                      <div className="text-white/60 mt-4">
                        Next game starting in 5 seconds...
                      </div>
                    </div>
                  ) : gameState.status === 'revealing' ? (
                    <div className="text-center">
                      <div className="w-24 h-24 border-8 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
                      <div className="text-white text-2xl font-semibold">Ball is in the air...</div>
                      <div className="text-white/60 mt-2">🏀 Revealing result...</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-24 h-24 border-8 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
                      <div className="text-white text-2xl font-semibold">Multiplayer Shot Loading...</div>
                    </div>
                  )}
                </div>
                {timeLeft !== null && timeLeft > 0 && (
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                    <div className="flex items-center gap-2 text-white">
                      <Clock size={18} />
                      <span className="font-bold">{timeLeft}s</span>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 right-4 bg-gradient-to-r from-blue-500 to-purple-500 backdrop-blur-sm px-4 py-2 rounded-full">
                  <div className="text-white font-bold text-lg">Pot: ${formatBalance(totalPot)}</div>
                </div>
              </div>

              {!gameState.betPlaced && gameState.status === 'betting' && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6">
                  <h3 className="text-2xl font-bold text-white mb-4">Place Your Bet</h3>
                  
                  <div className="mb-4">
                    <input
                      type="range"
                      min="10"
                      max={Math.min(500, user.balance)}
                      value={betAmount}
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-2">
                      <span className="text-white/60">$10</span>
                      <span className="text-2xl font-bold text-white">${betAmount}</span>
                      <span className="text-white/60">${Math.min(500, user.balance)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <button
                      onClick={() => setPrediction('MADE')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        prediction === 'MADE'
                          ? 'bg-green-500/30 border-green-400 scale-105'
                          : 'bg-white/5 border-white/20 hover:border-green-400/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">🏀</div>
                      <div className="text-lg font-bold text-white">Goes In</div>
                      {prediction === 'MADE' && (
                        <div className="text-green-400 text-sm mt-2">
                          Win: ${formatBalance(calculatePotentialWin(betAmount, 'MADE') - betAmount)}
                        </div>
                      )}
                    </button>

                    <button
                      onClick={() => setPrediction('MISSED')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        prediction === 'MISSED'
                          ? 'bg-red-500/30 border-red-400 scale-105'
                          : 'bg-white/5 border-white/20 hover:border-red-400/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">❌</div>
                      <div className="text-lg font-bold text-white">Misses</div>
                      {prediction === 'MISSED' && (
                        <div className="text-red-400 text-sm mt-2">
                          Win: ${formatBalance(calculatePotentialWin(betAmount, 'MISSED') - betAmount)}
                        </div>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={placeBet}
                    disabled={!prediction}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                      prediction
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    Join Game - ${betAmount}
                  </button>
                </div>
              )}

              {gameState.betPlaced && gameState.status === 'betting' && (
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6 text-center">
                  <div className="text-green-400 text-lg mb-2">✓ Bet Placed!</div>
                  <div className="text-white text-2xl font-bold mb-2">
                    ${betAmount} on {prediction === 'MADE' ? '🏀' : '❌'}
                  </div>
                  <div className="text-white/60 text-sm">
                    Potential Win: ${formatBalance(calculatePotentialWin(betAmount, prediction!) - betAmount)}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Players</h3>
                <div className="bg-blue-500/20 px-3 py-1 rounded-full">
                  <span className="text-blue-400 font-semibold">{multiplayerLobby.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                  <div className="text-green-400 text-sm mb-1">🏀 Goes In</div>
                  <div className="text-white font-bold text-xl">{madeCount}</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <div className="text-red-400 text-sm mb-1">❌ Misses</div>
                  <div className="text-white font-bold text-xl">{missedCount}</div>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sortedLobby.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    Waiting for players...
                  </div>
                ) : (
                  sortedLobby.map((player, idx) => {
                    const potentialWin = calculatePotentialWin(player.amount, player.prediction);
                    return (
                      <div
                        key={`${player.name}-${idx}`}
                        className={`p-3 rounded-lg transition-all ${
                          player.isUser
                            ? 'bg-blue-500/20 border border-blue-500/30'
                            : 'bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${
                              player.isUser
                                ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                : 'bg-gradient-to-br from-gray-500 to-gray-600'
                            }`} />
                            <span className="text-white font-medium">{player.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/80">${formatBalance(player.amount)}</span>
                            <span className={`text-lg ${
                              player.prediction === 'MADE' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {player.prediction === 'MADE' ? '🏀' : '❌'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-white/40 text-right">
                          Pot. Win: ${formatBalance(potentialWin - player.amount)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}