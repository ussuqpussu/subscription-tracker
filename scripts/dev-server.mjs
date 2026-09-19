import { pathToFileURL } from 'node:url'

const root = 'C:\\Users\\Артём\\Приложение календарь\\subscription-tracker'
const viteEntry = pathToFileURL(`${root}\\node_modules\\vite\\dist\\node\\index.js`).href
const { createServer } = await import(viteEntry)

const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 5173 },
})
await server.listen()
server.printUrls()
