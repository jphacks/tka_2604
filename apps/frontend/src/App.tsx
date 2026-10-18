import { BrowserRouter } from 'react-router'

import { AppRoutes } from './app/AppRoutes'
import { SessionProvider } from './app/SessionProvider'

function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  )
}

export default App
