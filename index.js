const express = require('express')
const Papa = require('papaparse')
const flatten = require('flat')

const { initSensor } = require('./config/sensor')

const port = process.env.PORT ?? 3000
const records = []
const gsToMeters = (g) => g * 9.80665

const state = {
  velocity: {
    x: 0,
    y: 0,
    z: 0
  },
  // dt = change in time (in seconds)
  dt: 0,
  lastRecordTime: new Date().getTime(),
  initialTime: new Date().getTime()
}

const app = express()

const recordData = async (id, sensor) => {
  const date = new Date()
  state.dt = date.getTime() - state.initialTime
  let record = {
    id,
    dt: state.dt,
    timestamp: date.toISOString()
  }

  sensor.read((err, sensorData) => {
    if (err) {
      record.error = err.message
    }
    record = { ...record, ...sensorData }

    if (record.accel) {
      const dt = (date.getTime() - state.lastRecordTime) / 1000
      state.velocity.x += gsToMeters(record.accel.x) * dt
      state.velocity.y += gsToMeters(record.accel.y) * dt
      state.velocity.z += gsToMeters(record.accel.z) * dt

      record.velocity = { ...state.velocity }
    }

    records.push(record)
    state.lastRecordTime = date.getTime()
  })
}

const start = async () => {
  const sensor = await initSensor()

  sensor.calibrateAccel({
    x: 0.0274608154296875,
    y: -0.001632171630859375,
    z: -0.110832763671875
  })
  sensor.calibrateGyro({
    x: 6.605760496183205,
    y: 3.004923187022901,
    z: 0.2697328244274818
  })

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
    console.log(records[records.length - 1])
  }, 1000)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
