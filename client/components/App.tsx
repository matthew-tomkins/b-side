import { Outlet, useLocation } from 'react-router'
import { useAuth } from '../hooks/useAuth'

function App() {
    const location = useLocation()
    const { isLoggedIn, logout } = useAuth()
    const showLogout = isLoggedIn && location.pathname !== '/'

  return (
    <div>
      {showLogout && (
        <div className="p-4 flex justify-end">
          <button
            onClick={logout}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      )}
      <Outlet />
    </div>
  )
}

export default App