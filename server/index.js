import dotenv from 'dotenv'
import process from 'node:process'
import app from './app.js'

dotenv.config()

const port = Number(process.env.PORT || 4000)

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`)
})
