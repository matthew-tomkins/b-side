import * as Path from 'node:path'
import express from 'express'
import cors, { CorsOptions } from 'cors'
import authRoutes from './routes/auth.ts'
import discogsRoutes from './routes/discogs.ts'
import queryParserRoutes from './routes/query-parser.ts'
import musicbrainzRoutes from './routes/musicbrainz/index.ts'
import configRoutes from './routes/config.ts'

const server = express()

server.use(express.json())
server.use(cors())

server.use('/api/auth', authRoutes)
server.use('/api/discogs', discogsRoutes)
server.use('/api/query-parser', queryParserRoutes)
server.use('/api/musicbrainz', musicbrainzRoutes)
server.use('/api/config', configRoutes)

if (process.env.NODE_ENV === 'production') {
  server.use(express.static(Path.resolve('public')))
  server.use('/assets', express.static(Path.resolve('./dist/assets')))
  server.get('*', (req, res) => {
    res.sendFile(Path.resolve('./dist/index.html'))
  })
}

export default server
