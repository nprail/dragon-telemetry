const express = require('express')
const Papa = require('papaparse')
const util = require('util')
const flatten = require('flat')

const { initSensor } = require('./config/sensor')

const port = process.env.PORT ?? 3000
const records = []

const app = express()

const recordData = async (id, sensor) => {
  const readSensor = util.promisify(sensor.read)

  let record = {
    id,
    timestamp: new Date().toISOString()
  }

  try {
    const sensorData = await readSensor()
    record = { ...record, ...sensorData }
  } catch (err) {
    record.error = err.message
  }

  records.push(record)
}

const start = async () => {
  const sensor = await initSensor()

  let id = 0

  setInterval(() => {
    id += 1
    recordData(id, sensor)
  }, 5)

  app.use(express.static('public'))

  app.get('/', (req, res) => {
    res.send(
      '<a href="/data">JSON Data</a><br><a href="/data.csv">CSV Data</a>'
    )
  })

  app.get('/current', (req, res, next) => {
    try {
      const record = records[records.length - 1]

      if (!record) {
        return res.json({ message: 'no record found' })
      }

      return res.json(record)
    } catch (err) {
      return next(err)
    }
  })

  app.get('/data', (req, res) => {
    return res.json(records)
  })

  app.get('/data.csv', (req, res) => {
    const flatRecords = records.map(flatten)
    const csv = Papa.unparse(flatRecords)

    res.header('Content-Type', 'text/csv')
    res.attachment('data.csv')

    return res.send(csv)
  })

  app.use((err, req, res, next) => {
    return res.json({
      error: err?.message ?? err.toString()
    })
  })

  app.listen(port, () => {
    console.log(`Server listening on ${port}`)
  })

  setInterval(() => {
    console.log('Record Count:', id)
  }, 1000)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
