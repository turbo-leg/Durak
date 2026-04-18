import { useGame } from './contexts/GameContext'
import { LoadingScreen } from './components/LoadingScreen'
import { GameBoard } from './components/GameBoard'
import './App.css'

function Game() {
  const { room, isConnected, error } = useGame()

  if (error) {
    return <LoadingScreen message={`Connection Error: ${error}`} isError={true} />
  }

  if (!isConnected || !room) {
    return <LoadingScreen message="Connecting to Game Server..." />
  }

  return (
    <div className="min-h-screen bg-green-950 text-white flex flex-col p-4 md:p-8">
      <header className="flex justify-between items-center mb-6 border-b border-green-800 pb-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
            ♦ Durak <span className="text-yellow-400">Online</span> ♦
          </h1>
        </div>
        <div className="bg-black/50 px-4 py-2 rounded-full text-xs font-mono shadow-inner border border-white/10 flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]"></div>
          <span>Room: <span className="text-yellow-300 font-bold">{room.id}</span></span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-2">
        <GameBoard />
      </main>
      
      <footer className="mt-4 text-center text-green-700 text-xs">
         © {new Date().getFullYear()} Durak Online — Multiplayer Framework Built with Colyseus.js
      </footer>
    </div>
  )
}

function App() {
  return <Game />
}

export default App
