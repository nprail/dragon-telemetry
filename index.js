const express = require('express')
const Papa = require('papaparse')
const flatten = require('flat')
const fs = require('fs-extra')

const port = process.env.PORT ?? 3000
let records = []
const gsToMeters = (g) => g * 9.80665

const app = express()

const fetchNewData = async (id) => {
  console.time(`fetchNewData-${id}`)
  const csvData = await fs.readFile(
    '../MPU6050-C-CPP-Library-for-Raspberry-Pi/data.csv',
    'utf8'
  )

  const jsonData = Papa.parse(csvData, {
    header: true
  })

  const state = {
    velocity: {
      x: 0,
      y: 0,
      z: 0
    }
  }

  const finalData = jsonData.data.map((record) => {
    const newRecord = {
      accel: {
        x: record.ax,
        y: record.ay,
        z: record.az
      },
      velocity: {
        x: 0,
        y: 0,
        z: 0
      }
    }

    if (record.ax) {
      const dtSeconds = record.dt * 0.000001
      state.velocity.x += gsToMeters(record.ax) * dtSeconds
      state.velocity.y += gsToMeters(record.ay) * dtSeconds
      state.velocity.z += gsToMeters(record.az) * dtSeconds

      newRecord.velocity = { ...state.velocity }
    }

    return newRecord
  })

  records = finalData
  console.timeEnd(`fetchNewData-${id}`)
}

const start = async () => {
  let id = 0
  setInterval(() => {
    id += 1
    fetchNewData(id)
  }, 100)

  app.use(express.static('public'))

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
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
