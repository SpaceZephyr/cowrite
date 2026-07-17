import { createApp } from './app.js'

const port = Number(process.env.COWRITE_PORT || 4320)
const app = createApp()

app.listen(port, '127.0.0.1', () => {
  console.log(`Cowrite API listening on http://127.0.0.1:${port}`)
})
