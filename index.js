const express = require('express')
const Papa = require('papaparse')
const flatten = require('flat')
const fs = require('fs-extra')

const port = process.env.PORT ?? 3000
let records = []
const gsToMeters = (g) => g * 9.80665

const app = express()

const round = (num) => Math.round(num * 100) / 100
const toRoundedNumber = (num) => round(parseFloat(num))

const instantVelocityFromGs = (g, dt) => {
  // if less than 1 g, assume it isn't actually moving
  if (g < 1) {
    return 0
  }

  return round(gsToMeters(g) * dt)
}

const fetchNewData = async (id) => {
  console.time(`fetchNewData-${id}`)
  const csvData = await fs.readFile(
    '../MPU6050-C-CPP-Library-for-Raspberry-Pi/data.csv',
    'utf8'
  )

  const jsonData = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true
  })

  const state = {
    id: 0,
    velocity: {
      x: 0,
      y: 0,
      z: 0
    }
  }

  const finalData = jsonData.data.map((record) => {
    const newRecord = {
      id: state.id,
      dt: parseFloat(record.dt),
      accel: {
        x: parseFloat(record.ax),
        y: parseFloat(record.ay),
        z: parseFloat(record.az)
      },
      velocity: {
        x: 0,
        y: 0,
        z: 0
      }
    }

    if (newRecord.accel) {
      const dtSeconds = newRecord.dt * 0.000001
      state.velocity.x += instantVelocityFromGs(newRecord.accel.x, dtSeconds)
      state.velocity.y += instantVelocityFromGs(newRecord.accel.y, dtSeconds)
      state.velocity.z += instantVelocityFromGs(newRecord.accel.z, dtSeconds)

      newRecord.velocity = { ...state.velocity }

      // round after doing math
      newRecord.accel.x = toRoundedNumber(newRecord.accel.x)
      newRecord.accel.y = toRoundedNumber(newRecord.accel.y)
      newRecord.accel.z = toRoundedNumber(newRecord.accel.z)
    }

    state.id += 1

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
  }, 500)

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
