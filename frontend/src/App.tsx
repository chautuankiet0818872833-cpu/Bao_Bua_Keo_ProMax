import './App.css'
import Navbar from './components/Navbar'
import CreateRoomModal from './components/CreateRoomModal'
import GameDashboard from './components/GameDashboard'

function App() {
  return (
    <div className="min-vh-100 bg-dark text-white">
      <Navbar />
      <CreateRoomModal id="createRoomModal" />
      
      <main className="container py-5">
        <div className="text-center mb-5">
          <button 
            className="btn btn-success btn-lg rounded-pill px-5 shadow-lg fw-bold"
            data-bs-toggle="modal"
            data-bs-target="#createRoomModal"
          >
            <i className="bi bi-plus-circle-fill me-2"></i>
            Tạo Phòng Mới
          </button>
        </div>

        <GameDashboard />
      </main>
    </div>
  )
}

export default App
