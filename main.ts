function calcInt (higher: number, lower: number) {
    o = 256 * higher + lower
    if (o > 32767) {
        return o - 65536
    }
    return o
}
function setDeviceConfig (f5: number, f6: number) {
    // LSByte – 0x55
    lsByteCheck2 = f5 - 85
    lsByte2 = f5
    // MSByte – 0x55
    msByteCheck2 = f6 - 85
    msByte2 = f6
    const d = pins.createBufferFromArray([0x03, lsByteCheck2, lsByte2, msByteCheck2, msByte2]);
serial.writeLine("device config " + d.toHex())
    pins.i2cWriteBuffer(0x60, d, false);
}
function readCompensationPixel () {
    const buf3 = pins.createBufferFromArray([0x02, 0x41, 0x00, 0x01])
pins.i2cWriteBuffer(0x60, buf3, true)
const response3 = pins.i2cReadBuffer(0x60, 2, false)
return 256 * response3[1] + response3[0]
}
function calcVCompensated (v: number) {
	
}
function detectBrownout () {
    const buf = pins.createBufferFromArray([0x02, 0x92, 0x00, 0x01]);
pins.i2cWriteBuffer(0x60, buf, true);
const response = pins.i2cReadBuffer(0x60, 0x02, false);
const brownout = ((response[0] >> 2) & 0x01);
serial.writeLine("brownout: " + brownout.toString())
    return brownout == 0
}
function readConfigParameterRAM () {
    command = 2
    startAddress = 146
    addressStep = 0
    nbReads = 1
    const buf2 = pins.createBufferFromArray([command, startAddress, addressStep, nbReads]);
pins.i2cWriteBuffer(0x60, buf2, true);
const response2 = pins.i2cReadBuffer(0x60, nbReads * 2, false);
return response2
}
function readAll () {
    const e = pins.createBufferFromArray([0x2, 0, 1, 0x40])
pins.i2cWriteBuffer(0x60, e, true);
const response4 = pins.i2cReadBuffer(0x60, 0x40 * 2, false);
serial.writeLine("read buffer " + response4.toHex())
    for (; n < 0x40 * 2; n = n + 2) {
        let val = response4[n] + response4[n + 1] * 256
        serial.writeLine(`${val} = ${response4[n]} + ${response4[n + 1]} * 256`)
        if (val > 32767) {
            val = val - 65536
        }
        values.push(val)
    }
serial.writeLine("got pixels " + JSON.stringify(values))
    return values
}
function readInitData () {
    pins.i2cWriteNumber(
    80,
    0,
    NumberFormat.Int8BE,
    true
    )
    const b = pins.i2cReadBuffer(0x50, 0xff, false);
return b
}
function readPtat () {
    const buf4 = pins.createBufferFromArray([0x2, 0x40, 0x00, 0x01])
serial.writeLine("write ptat command: " + buf4.toHex())
    pins.i2cWriteBuffer(0x60, buf4, true);
const buff = pins.i2cReadBuffer(0x60, 2, false)
ptat = 256 * buff[1] + buff[0]
    return ptat
}
function initOscillator (oscParameter: number) {
    // LSByte – 0xAA
    const lsByteCheck = (oscParameter - 0xAA) & 0xff;
lsByte = oscParameter
    // MSByte – 0xAA
    const msByteCheck = (0x00 - 0xAA) & 0xff;
const c = pins.createBufferFromArray([0x04, lsByteCheck, lsByte, msByteCheck, msByte]);
serial.writeLine("osc parameter " + c.toHex())
    pins.i2cWriteBuffer(0x60, c, false);
}
let pixels = 0
let ptat2 = 0
let config_param = 0
let oscParameter = 0
let f6 = 0
let f5 = 0
let lsByte = 0
let ptat = 0
let nbReads = 0
let addressStep = 0
let startAddress = 0
let command = 0
let msByte2 = 0
let msByteCheck2 = 0
let lsByte2 = 0
let lsByteCheck2 = 0
let o = 0
let t0: number[] = []
let values = []
let n = 0
let msByte = 0
function calculateTA(config: Buffer, ptat: number) {
    const vth = calcInt(config[0xDB], config[0xDA]);
    const kt1 = calcInt(config[0xDD], config[0xDC]);
    const kt2 = calcInt(config[0xDF], config[0xDE]);

    serial.writeLine("vth: " + vth.toString() + " kt1: " + kt1 + " kt2: " + kt2);

    return ((-kt1 + Math.sqrt(Math.pow(kt1, 2) - (4 * kt2 * (vth - ptat)))) / (2 * kt2)) + 25;
}
basic.pause(1000)
let config = readInitData()
basic.forever(function () {
    if (detectBrownout()) {
        f5 = config[245]
        f6 = config[246]
        oscParameter = config[247]
        serial.writeLine("Oscillator parameter:" + oscParameter.toString())
        serial.writeLine("Configuration register parameter F5:" + f5.toString())
        serial.writeLine("Configuration register parameter F6:" + f6.toString())
        initOscillator(oscParameter)
        setDeviceConfig(f5, f6)
    }
    config_param = readConfigParameterRAM()
    serial.writeLine("Read config register: " + config_param.toHex() + " Should match 0x3E46")
    const configreg = config_param[0] & 3 << 4
const m = new mlx90621.MLX90261(
        config[0x22],
        config[0x62],
        config[0xA2],
        config[0xC0],
        config[0xC4],
        config[0xD0],
        config[0xD1],
        config[0xD3],
        config[0xD4],
        config[0xD5],
        config[0xD6],
        config[0xD7],
        config[0xD8],
        config[0xD9],
        config[0xE0],
        config[0xE1],
        config[0xE2],
        config[0xE3],
        config[0xE4],
        config[0xE5],
        config[0xE6],
        config[0xE7],
        config[0xDA],
        config[0xDB],
        config[0xDC],
        config[0xDD],
        config[0xDE],
        config[0xDF],
        config[0xD2]
    )
ptat2 = readPtat()
    const ta = m.ta(ptat2, configreg)
serial.writeLine("" + (`ta: ${ta}`))
    pixels = readAll()
    pixels.forEach(_ => t0.push(-278))
m.t0allDies(pixels, readCompensationPixel(), ta, configreg, t0)
serial.writeLine("" + (`t0: ${JSON.stringify(t0)}`))
    const max = t0.reduce((acc, el) => {
        if (el > acc) {
            return el
        } else {
            return acc
        }
    }, -279)
basic.showNumber(max)
    serial.writeLine("" + (`max: ${max}`))
    basic.pause(10000)
})
