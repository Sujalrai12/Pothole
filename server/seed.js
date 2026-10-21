import 'dotenv/config'
import mongoose from 'mongoose'
import Report from './models/Report.js'
import { demoReports } from './data.js'

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/roadwatch'

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  const operations = demoReports.map((report) => ({
    updateOne: {
      filter: { reference: report._id },
      update: { $setOnInsert: {
        reference: report._id,
        neighborhood: report.neighborhood,
        road: report.road,
        description: '',
        image: report.image,
        location: { type: 'Point', coordinates: [report.lng, report.lat] },
        lat: report.lat,
        lng: report.lng,
        severity: report.severity,
        status: report.status,
        createdAt: new Date(report.createdAt),
      } },
      upsert: true,
    },
  }))
  const result = await Report.bulkWrite(operations)
  console.log(`Seed complete: ${result.upsertedCount} sample reports added; existing reports were preserved.`)
} catch (error) {
  console.error(`Could not seed MongoDB: ${error.message}`)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
