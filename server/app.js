import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import profileRoutes from './routes/profile.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/profile', profileRoutes)
app.use('/auth', authRoutes)
app.use('/products', productRoutes)
app.use('/profile', profileRoutes)

app.use((error, _req, res, next) => {
  void next
  console.error(error)
  res.status(error.status || 500).json({ message: error.expose ? error.message : 'Internal server error' })
})

export default app
