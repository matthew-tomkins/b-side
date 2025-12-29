import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from 'react-router'

import App from './components/App'
import Login from './components/Login'
import Callback from './components/Callback'
import Dashboard from './components/Dashboard'
import SimplifiedExplorerMode from './components/SimplifiedExplorerMode'

const routes = createRoutesFromElements(
  <Route path="/" element={<App />}>
    <Route index element={<Login />} />
    <Route path="callback" element={<Callback />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="compare" element={<SimplifiedExplorerMode />} />
  </Route>
)

const router = createBrowserRouter(routes)

export default router