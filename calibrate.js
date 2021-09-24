const i2c = require('i2c-bus')
const MPU6050 = require('i2c-mpu6050')

const address = 0x68
const i2c1 = i2c.openSync(1)

const sensor = new MPU6050(i2c1, address)
// const readGyro = util.promisify(sensor.readGyro)
// const readAccel = util.promisify(sensor.readGyro)

const readGyro = () =>
  new Promise((resolve, reject) => {
    sensor.readGyro((err, data) => {
      if (err) {
        return reject(err)
      }

      return resolve(data)
    })
  })

const readAccel = () =>
  new Promise((resolve, reject) => {
    sensor.readAccel((err, data) => {
      if (err) {
        return reject(err)
      }

      return resolve(data)
    })
  })

const buffersize = 1000
const acelDeadzone = 8 // Acelerometer error allowed, make it lower to get more precision, but sketch may not converge  (default:8)
const giroDeadzone = 1 // Giro error allowed, make it lower to get more precision, but sketch may not converge  (default:1)

let meanAx
let meanAy
let meanAz
let meanGx
let meanGy
let meanGz
let state = 0

let axOffset
let ayOffset
let azOffset
let gxOffset
let gyOffset
let gzOffset

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })

const meansensors = async () => {
  let i = 0
  let buffAx = 0
  let buffAy = 0
  let buffAz = 0
  let buffGx = 0
  let buffGy = 0
  let buffGz = 0

  while (i < buffersize + 101) {
    // read raw accel/gyro measurements from device
    const g = await readGyro()
    const a = await readAccel()

    if (i > 100 && i <= buffersize + 100) {
      // First 100 measures are discarded
      buffAx = buffAx + a.x
      buffAy = buffAy + a.y
      buffAz = buffAz + a.z
      buffGx = buffGx + g.x
      buffGy = buffGy + g.y
      buffGz = buffGz + g.z
    }
    if (i === buffersize + 100) {
      meanAx = buffAx / buffersize
      meanAy = buffAy / buffersize
      meanAz = buffAz / buffersize
      meanGx = buffGx / buffersize
      meanGy = buffGy / buffersize
      meanGz = buffGz / buffersize
    }
    i++
    await sleep(2) // Needed so we don't get repeated measures
  }
}

const calibration = async () => {
  axOffset = -meanAx / 8
  ayOffset = -meanAy / 8
  azOffset = (16384 - meanAz) / 8

  gxOffset = -meanGx / 4
  gyOffset = -meanGy / 4
  gzOffset = -meanGz / 4
  while (1) {
    let ready = 0
    // accelgyro.setXAccelOffset(axOffset)
    // accelgyro.setYAccelOffset(ayOffset)
    // accelgyro.setZAccelOffset(azOffset)

    // accelgyro.setXGyroOffset(gxOffset)
    // accelgyro.setYGyroOffset(gyOffset)
    // accelgyro.setZGyroOffset(gzOffset)

    await meansensors()
    console.log('...')

    if (Math.abs(meanAx) <= acelDeadzone) {
      ready++
    } else {
      axOffset = axOffset - meanAx / acelDeadzone
    }

    if (Math.abs(meanAy) <= acelDeadzone) {
      ready++
    } else {
      ayOffset = ayOffset - meanAy / acelDeadzone
    }

    if (Math.abs(16384 - meanAz) <= acelDeadzone) {
      ready++
    } else {
      azOffset = azOffset + (16384 - meanAz) / acelDeadzone
    }

    if (Math.abs(meanGx) <= giroDeadzone) {
      ready++
    } else {
      gxOffset = gxOffset - meanGx / (giroDeadzone + 1)
    }

    if (Math.abs(meanGy) <= giroDeadzone) {
      ready++
    } else {
      gyOffset = gyOffset - meanGy / (giroDeadzone + 1)
    }

    if (Math.abs(meanGz) <= giroDeadzone) {
      ready++
    } else {
      gzOffset = gzOffset - meanGz / (giroDeadzone + 1)
    }

    if (ready === 6) {
      break
    }
  }
}

const loop = async () => {
  if (state === 0) {
    console.log('\nReading sensors for first time...')
    await meansensors()
    state++
    await sleep(1000)
  }

  if (state === 1) {
    console.log('\nCalculating offsets...')
    await calibration()
    state++
    await sleep(1000)
  }

  if (state === 2) {
    await meansensors()
    console.log('FINISHED!')
    console.log('Sensor readings with offsets:')
    console.log(meanAx, meanAy, meanAz, meanGx, meanGy, meanGz)
    console.log('Your offsets:')
    console.log(axOffset, ayOffset, azOffset, gxOffset, gyOffset, gzOffset)
    console.log('Data is printed as: acelX acelY acelZ giroX giroY giroZ')
    console.log('Check that your sensor readings are close to 0 0 16384 0 0 0')
    console.log(
      'If calibration was successful write down your offsets so you can set them in your projects using something similar to mpu.setXAccelOffset(youroffset)'
    )
  }
}

const runLoop = async () => {
  console.log('Startup')
  while (1) {
    await loop()
  }
}

runLoop()
