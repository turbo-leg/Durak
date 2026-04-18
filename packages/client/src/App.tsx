import { useGame } from './contexts/GameContext'
import { LoadingScreen } from './components/LoadingScreen'
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
    <div className="min-h-screen bg-green-900 text-white p-8">
      <header className="flex justify-between items-center mb-8 border-b border-green-700 pb-4">
        <h1 className="text-3xl font-bold">Durak Online</h1>
        <div className="bg-green-800 px-4 py-2 rounded-full text-sm shadow">
          Connected to Room: <span className="font-mono text-yellow-300">{room.id}</span>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center h-[70vh]">
        <h2 className="text-xl text-green-200 mb-4">Playmat UI goes here!</h2>
        <p className="text-gray-400">Waiting for players...</p>
      </main>
    </div>
  )
}

function App() {
  return <Game />
}

export default App
