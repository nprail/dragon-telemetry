const i2c = require('i2c-bus')
const MPU6050 = require('i2c-mpu6050')

const address = 0x68

const initSensor = async () => {
  const i2c1 = await i2c.openPromisified(1)

  const sensor = new MPU6050(i2c1, address)

  return sensor

  //   return {
  //     read: (done) => {
  //       return done(null, {
  //         gyro: { x: 0, y: 0, z: 0 },
  //         accel: { x: 0, y: 0, z: 0 },
  //         rotation: { x: 0, y: 0 },
  //         temp: 0
  //       })
  //     }
  //   }
}

module.exports = { initSensor }
