import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import mongoose from 'mongoose'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Report from './models/Report.js'
import StaffMember from './models/StaffMember.js'
import User from './models/User.js'
import { demoReports } from './data.js'

const app = express()
const port = process.env.PORT || 5001
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roadwatch'
const jwtSecret = process.env.JWT_SECRET
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.resolve(__dirname, '../uploads')
mkdirSync(uploadsDir, { recursive: true })
let mongoConnected = false
let localReports = [...demoReports]
let localStaff = []
const allowedStatuses = ['Reported', 'In progress', 'Fixed']
const allowedRoles = ['Administrator', 'Municipal Officer', 'Field Engineer']
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim()).filter(Boolean)
const authCookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' }
const authAttempts = new Map()

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('Upload a JPG, PNG or WebP image.'))
    callback(null, true)
  },
})

app.disable('x-powered-by')
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(uploadsDir, { fallthrough: false, maxAge: '1d' }))

const toClientReport = (report) => ({
  ...report,
  _id: report.reference || report._id,
  lat: report.lat ?? report.location?.coordinates?.[1],
  lng: report.lng ?? report.location?.coordinates?.[0],
})

const errorMessage = (error) => {
  const details = `${error?.name || ''} ${error?.message || ''}`
  if (/MongooseServerSelectionError|MongoNetworkError|MongoNetworkTimeoutError|SSL routines|tlsv1 alert/i.test(details)) {
    return process.env.NODE_ENV === 'production'
      ? 'The deployed server could not connect to MongoDB Atlas. In Render, open this Web Service → Connect → Outbound and add its outbound IP ranges to Atlas → Security → Network Access. Also verify MONGO_URI and the Atlas database user.'
      : 'The database connection failed. Add this computer’s public IP to the MongoDB Atlas Network Access list, verify MONGO_URI and the Atlas database user, then restart the server.'
  }
  return process.env.NODE_ENV === 'production' ? 'The request could not be completed.' : error.message
}
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function rateLimitAuth(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const current = authAttempts.get(key)
  if (!current || now - current.startedAt > 15 * 60 * 1000) authAttempts.set(key, { startedAt: now, count: 1 })
  else if (current.count >= 20) return res.status(429).json({ message: 'Too many sign-in attempts. Try again in 15 minutes.' })
  else current.count += 1
  return next()
}

function setSessionCookie(res, user) {
  if (!jwtSecret) throw new Error('JWT_SECRET is missing from the server environment.')
  const token = jwt.sign({ sub: String(user._id) }, jwtSecret, { expiresIn: '7d' })
  res.cookie('roadwatch_session', token, authCookieOptions)
}

function getReportPhotoBucket() {
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected; report photos cannot be stored.')
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'reportPhotos' })
}

function storeReportPhoto(file, reference, userId) {
  const bucket = getReportPhotoBucket()
  return new Promise((resolve, reject) => {
    const upload = bucket.openUploadStream(`${reference}-${randomUUID()}`, {
      contentType: file.mimetype,
      metadata: { reference, submittedBy: String(userId) },
    })
    upload.once('error', reject)
    upload.once('finish', () => resolve(upload.id))
    upload.end(file.buffer)
  })
}

const toClientUser = (user) => ({ _id: user._id, name: user.name, email: user.email, role: user.role })

async function requireAuth(req, res, next) {
  try {
    if (!mongoConnected) return res.status(503).json({ message: 'Sign-in requires the MongoDB connection.' })
    if (!jwtSecret) return res.status(503).json({ message: 'Authentication is not configured. Add JWT_SECRET to the server environment.' })
    const token = req.cookies?.roadwatch_session
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' })
    const payload = jwt.verify(token, jwtSecret)
    const user = await User.findById(payload.sub).lean()
    if (!user) return res.status(401).json({ message: 'Your account is no longer available. Please sign in again.' })
    req.user = user
    return next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
    return res.status(500).json({ message: errorMessage(error) })
  }
}

const requireAdmin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Administrator access is required.' })
const requireCitizen = (req, res, next) => req.user?.role === 'citizen' ? next() : res.status(403).json({ message: 'Only citizens can submit pothole reports.' })

function validateReportInput(body = {}) {
  const neighborhood = typeof body.neighborhood === 'string' ? body.neighborhood.trim() : ''
  const wardNumber = typeof body.wardNumber === 'string' ? body.wardNumber.trim() : ''
  const road = typeof body.road === 'string' ? body.road.trim() : ''
  const zone = typeof body.zone === 'string' ? body.zone.trim() : ''
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!neighborhood || !wardNumber || !road || !zone) return { error: 'Neighborhood, ward number, road name and zone are required.' }
  if (neighborhood.length > 100 || wardNumber.length > 20 || road.length > 180 || zone.length > 100) return { error: 'Location fields are too long.' }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return { error: 'A valid latitude and longitude are required.' }
  const severity = body.severity || 'Medium'
  if (!['Low', 'Medium', 'High'].includes(severity)) return { error: 'Severity must be Low, Medium or High.' }
  return { value: { neighborhood, wardNumber, road, zone, lat, lng, severity, description: String(body.description || '').trim().slice(0, 1200), imageUrl: String(body.imageUrl || '').trim().slice(0, 1000) } }
}

function distanceInMeters(aLat, aLng, bLat, bLng) {
  const radians = (degrees) => degrees * Math.PI / 180
  const dLat = radians(bLat - aLat)
  const dLng = radians(bLng - aLng)
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoConnected ? 'connected' : 'disconnected', databaseName: mongoose.connection.name || 'roadwatch' }))

app.post('/api/auth/register', rateLimitAuth, async (req, res) => {
  if (!mongoConnected) return res.status(503).json({ message: 'Registration requires the MongoDB connection.' })
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!name || name.length > 100) return res.status(400).json({ message: 'Enter your name (up to 100 characters).' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ message: 'Enter a valid email address.' })
  if (password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Use a password between 8 and 128 characters.' })
  try {
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'citizen' })
    setSessionCookie(res, user)
    return res.status(201).json({ user: toClientUser(user) })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' })
    return res.status(500).json({ message: errorMessage(error) })
  }
})

app.post('/api/auth/login', rateLimitAuth, async (req, res) => {
  if (!mongoConnected) return res.status(503).json({ message: 'Sign-in requires the MongoDB connection.' })
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  try {
    const user = await User.findOne({ email }).select('+passwordHash')
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    setSessionCookie(res, user)
    return res.json({ user: toClientUser(user) })
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }) }
})

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: toClientUser(req.user) }))
app.post('/api/auth/logout', (_req, res) => res.clearCookie('roadwatch_session', { ...authCookieOptions, maxAge: undefined }).json({ status: 'ok' }))

app.get('/api/team', requireAuth, requireAdmin, async (_req, res) => {
  try {
    if (!mongoConnected) return res.json(localStaff)
    const members = await StaffMember.find().sort({ createdAt: -1 }).lean()
    return res.json(members.map((member) => ({ ...member, initials: member.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() })))
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }) }
})

app.post('/api/team', requireAuth, requireAdmin, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const role = req.body.role || 'Field Engineer'
  if (!name || name.length > 100) return res.status(400).json({ message: 'Enter a name of up to 100 characters.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' })
  if (!allowedRoles.includes(role)) return res.status(400).json({ message: 'Choose a valid team role.' })
  try {
    if (!mongoConnected) {
      if (localStaff.some((member) => member.email === email)) return res.status(409).json({ message: 'A team member with that email already exists.' })
      const member = { _id: randomUUID(), name, email, role, zone: role === 'Administrator' ? 'All zones' : 'Unassigned', status: 'Pending', initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), createdAt: new Date().toISOString() }
      localStaff.unshift(member)
      return res.status(201).json(member)
    }
    const member = await StaffMember.create({ name, email, role, zone: role === 'Administrator' ? 'All zones' : 'Unassigned', status: 'Pending' })
    return res.status(201).json({ ...member.toObject(), initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A team member with that email already exists.' })
    return res.status(500).json({ message: errorMessage(error) })
  }
})

app.get('/api/photos/:id', requireAuth, async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Photo not found.' })
  try {
    const photoId = new mongoose.Types.ObjectId(req.params.id)
    const imageUrl = `/api/photos/${photoId}`
    const report = await Report.findOne({ imageUrl, ...(req.user.role === 'admin' ? {} : { submittedBy: req.user._id }) }).select('_id').lean()
    if (!report) return res.status(404).json({ message: 'Photo not found.' })
    const bucket = getReportPhotoBucket()
    const [photo] = await bucket.find({ _id: photoId }).toArray()
    if (!photo) return res.status(404).json({ message: 'Photo not found.' })
    res.set('Content-Type', photo.contentType || photo.metadata?.contentType || 'application/octet-stream')
    res.set('Cache-Control', 'private, max-age=3600')
    return bucket.openDownloadStream(photoId).on('error', next).pipe(res)
  } catch (error) { return next(error) }
})

app.get('/api/reports/nearby', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const radius = Math.min(Math.max(Number(req.query.radius) || 20, 1), 5000)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return res.status(400).json({ message: 'Valid lat and lng query parameters are required.' })
  try {
    if (!mongoConnected) {
      const nearby = localReports.filter((report) => (req.user.role === 'admin' || String(report.submittedBy) === String(req.user._id)) && report.status !== 'Fixed' && distanceInMeters(lat, lng, report.lat, report.lng) <= radius)
      return res.json(nearby)
    }
    const nearby = await Report.find({ ...(req.user.role === 'admin' ? {} : { submittedBy: req.user._id }), status: { $ne: 'Fixed' }, location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radius } } }).limit(20).lean()
    return res.json(nearby.map(toClientReport))
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }) }
})

app.get('/api/reports', requireAuth, async (req, res) => {
  const { status, q } = req.query
  if (status && !allowedStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status filter.' })
  const search = typeof q === 'string' ? q.trim().slice(0, 100) : ''
  try {
    if (!mongoConnected) {
      const filtered = localReports.filter((report) => (req.user.role === 'admin' || String(report.submittedBy) === String(req.user._id)) && (!status || report.status === status) && (!search || `${report.neighborhood} ${report.wardNumber} ${report.road} ${report.zone} ${report._id}`.toLowerCase().includes(search.toLowerCase())))
      return res.json(filtered)
    }
    const filter = {}
    if (req.user.role !== 'admin') filter.submittedBy = req.user._id
    if (status) filter.status = status
    if (search) {
      const expression = new RegExp(escapeRegExp(search), 'i')
      filter.$or = [{ neighborhood: expression }, { wardNumber: expression }, { road: expression }, { zone: expression }, { reference: expression }]
    }
    const reports = await Report.find(filter).populate('submittedBy', 'name email').sort({ createdAt: -1 }).limit(250).lean()
    return res.json(reports.map(toClientReport))
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }) }
})

app.get('/api/reports/:id', requireAuth, async (req, res) => {
  try {
    const report = mongoConnected
      ? await Report.findOne({ reference: req.params.id, ...(req.user.role === 'admin' ? {} : { submittedBy: req.user._id }) }).lean()
      : localReports.find((item) => item._id === req.params.id)
    if (!report || (req.user.role !== 'admin' && String(report.submittedBy) !== String(req.user._id))) return res.status(404).json({ message: 'Report not found.' })
    return res.json(toClientReport(report))
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }) }
})

app.post('/api/reports', requireAuth, requireCitizen, photoUpload.single('photo'), async (req, res) => {
  const validation = validateReportInput(req.body)
  if (validation.error) return res.status(400).json({ message: validation.error })
  if (!req.file) return res.status(400).json({ message: 'A pothole photo is required.' })
  if (!mongoConnected) return res.status(503).json({ message: 'Connect to MongoDB before uploading a photo so it can be saved to the database.' })
  const input = { ...validation.value }
  let photoId
  try {
    const duplicates = await Report.find({ status: { $ne: 'Fixed' }, location: { $near: { $geometry: { type: 'Point', coordinates: [input.lng, input.lat] }, $maxDistance: 20 } } }).limit(10).lean()
    if (duplicates.length) return res.status(409).json({ message: 'A nearby open pothole report already exists.', duplicates: duplicates.map(toClientReport) })

    const reference = `RW-${Date.now().toString().slice(-6)}-${randomUUID().slice(0, 6).toUpperCase()}`
    photoId = await storeReportPhoto(req.file, reference, req.user._id)
    input.imageUrl = `/api/photos/${photoId}`
    const saved = await Report.create({ ...input, reference, status: 'Reported', submittedBy: req.user._id, location: { type: 'Point', coordinates: [input.lng, input.lat] } })
    return res.status(201).json(toClientReport(saved.toObject()))
  } catch (error) {
    if (photoId && mongoose.connection.readyState === 1) await getReportPhotoBucket().delete(photoId).catch(() => {})
    return res.status(500).json({ message: errorMessage(error) })
  }
})

app.patch('/api/reports/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const { status, note = '' } = req.body || {}
  if (!allowedStatuses.includes(status)) return res.status(400).json({ message: 'Status must be Reported, In progress or Fixed.' })
  try {
    if (!mongoConnected) {
      const report = localReports.find((item) => item._id === req.params.id)
      if (!report) return res.status(404).json({ message: 'Report not found.' })
      report.status = status
      return res.json(report)
    }
    const report = await Report.findOneAndUpdate(
      { reference: req.params.id },
      { $set: { status }, $push: { statusHistory: { status, changedAt: new Date(), note: String(note).trim().slice(0, 500) } } },
      { new: true, runValidators: true },
    ).lean()
    if (!report) return res.status(404).json({ message: 'Report not found.' })
    return res.json(toClientReport(report))
  } catch (error) { return res.status(500).json({ message: errorMessage(error) }) }
})

app.use('/api', (_req, res) => res.status(404).json({ message: 'RoadWatch API route not found. Check the deployed server URL and API route.' }))

app.use((error, _req, res, _next) => {
  console.error(error)
  const status = error instanceof multer.MulterError ? error.code === 'LIMIT_FILE_SIZE' ? 413 : 400 : 400
  res.status(error.status || status).json({ message: errorMessage(error) })
})

if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

mongoose.connection.on('disconnected', () => { mongoConnected = false; console.warn('MongoDB disconnected') })
mongoose.connection.on('connected', () => { mongoConnected = true })

async function startServer() {
  if (!jwtSecret) console.warn('JWT_SECRET is not configured. Authentication endpoints will not accept sessions.')
  app.listen(port, host, () => console.log(`RoadWatch API listening on http://${host}:${port}`))

  const connectToDatabase = async () => {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
      mongoConnected = true
      console.log(`MongoDB connected: ${mongoose.connection.name}`)
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
      const adminPassword = process.env.ADMIN_PASSWORD
      if (adminEmail && adminPassword) {
        const existingAdmin = await User.findOne({ email: adminEmail })
        if (!existingAdmin) {
          await User.create({ name: process.env.ADMIN_NAME || 'RoadWatch Administrator', email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: 'admin' })
          console.log(`Initial administrator account created for ${adminEmail}`)
        } else if (existingAdmin.role !== 'admin') {
          existingAdmin.role = 'admin'
          await existingAdmin.save()
          console.log(`Configured administrator role for ${adminEmail}`)
        }
      } else {
        console.warn('ADMIN_EMAIL and ADMIN_PASSWORD are not configured. Set both to bootstrap the first administrator.')
      }
    } catch (error) {
      mongoConnected = mongoose.connection.readyState === 1
      console.warn(`MongoDB is unavailable. ${errorMessage(error)} API is using demo data until MongoDB starts.`)
      if (!mongoConnected) {
        const retry = setTimeout(connectToDatabase, 10000)
        retry.unref?.()
      }
    }
  }

  connectToDatabase()
}

startServer()
