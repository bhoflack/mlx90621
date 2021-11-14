function initOscillator(oscParameter: number) {
    const lsByteCheck = (oscParameter - 0xAA) & 0xff; // LSByte – 0xAA
    const lsByte = oscParameter;
    const msByteCheck = (0x00 - 0xAA) & 0xff; // MSByte – 0xAA
    const msByte = 0;
    // osc parameter 04a34d5600
    //               04a34d5600

    const c = pins.createBufferFromArray([0x04, lsByteCheck, lsByte, msByteCheck, msByte]);
    serial.writeLine("osc parameter " + c.toHex())
    pins.i2cWriteBuffer(0x60, c, false);
}

function readInitData() {
    pins.i2cWriteNumber(
        0x50,
        0x00,
        NumberFormat.Int8BE,
        true
    );

    const b = pins.i2cReadBuffer(0x50, 0xff, false);
    return b;
}

function setDeviceConfig(f5: number, f6: number) {
    const lsByteCheck2 = f5 - 0x55; // LSByte – 0x55
    const lsByte2 = f5
    const msByteCheck2 = f6 - 0x55; // MSByte – 0x55
    const msByte2 = f6
    const d = pins.createBufferFromArray([0x03, lsByteCheck2, lsByte2, msByteCheck2, msByte2]);
    serial.writeLine("device config " + d.toHex())
    pins.i2cWriteBuffer(0x60, d, false);
}

function detectBrownout() {
    const buf = pins.createBufferFromArray([0x02, 0x92, 0x00, 0x01]);
    pins.i2cWriteBuffer(0x60, buf, true);
    const response = pins.i2cReadBuffer(0x60, 0x02, false);
    const brownout = ((response[0] >> 2) & 0x01);
    serial.writeLine("brownout: " + brownout.toString());
    return brownout == 0;
}

function readConfigParameterRAM() {
    const command = 0x02;
    const startAddress = 0x92;
    const addressStep = 0x00;
    const nbReads = 0x01;
    const buf = pins.createBufferFromArray([command, startAddress, addressStep, nbReads]);
    pins.i2cWriteBuffer(0x60, buf, true);
    const response = pins.i2cReadBuffer(0x60, nbReads * 2, false);
    return response;
}

function readCompensationPixel() {
    const buf = pins.createBufferFromArray([0x02, 0x41, 0x00, 0x01])
    pins.i2cWriteBuffer(0x60, buf, true)
    const response = pins.i2cReadBuffer(0x60, 2, false)
    const v = 256 * response[1] + response[0]

    if (v > 32768) {
        return v - 65536
    }
    return v
}

function readIrData() {
    pins.i2cWriteBuffer(0x60, pins.createBufferFromArray([0x02, 0x00, 0x01, 0x40]), true)
    const response = pins.i2cReadBuffer(0x60, 0x40 * 2, false);
    let n = 0;
    let pixel = 0;
    serial.writeLine("read buffer " + response.toHex());
    let values = [];

    for (; n < 0x40 * 2; n = n + 2) {
        let val = response[n] + response[n+1] * 256
        val = (val > 32768)? val - 65536 : val
        values.push(val)
    }
    serial.writeLine("got pixels " + JSON.stringify(values))
    return values
}
function readPtat() {
    const buf = pins.createBufferFromArray([0x2, 0x40, 0x00, 0x01])
    serial.writeLine("write ptat command: " + buf.toHex())
    pins.i2cWriteBuffer(0x60, buf, true);
    const buff = pins.i2cReadBuffer(0x60, 2, false)
    const ptat = 256 * buff[1] + buff[0];
    return ptat;
}

function calculateTA(config: Buffer, ptat: number) {
    const vth = calcInt(config[0xDB], config[0xDA]);
    const kt1 = calcInt(config[0xDD], config[0xDC]);
    const kt2 = calcInt(config[0xDF], config[0xDE]);

    serial.writeLine("vth: " + vth.toString() + " kt1: " + kt1 + " kt2: " + kt2);

    return ((-kt1 + Math.sqrt(Math.pow(kt1, 2) - (4 * kt2 * (vth - ptat)))) / (2 * kt2)) + 25;
}

function calcInt(higher: number, lower: number): number {
    let n = 256 * higher + lower;
    if (n > 32767) {
        return n - 65536;
    }
    return n;
}

basic.pause(1000);

const config = readInitData();

basic.forever(function () {

    if (detectBrownout()) {
        const f5 = config[0xf5];
        const f6 = config[0xf6];
        const oscParameter = config[0xf7];

        serial.writeLine("Oscillator parameter:" + oscParameter.toString())
        serial.writeLine("Configuration register parameter F5:" + f5.toString())
        serial.writeLine("Configuration register parameter F6:" + f6.toString())

        initOscillator(oscParameter);
        setDeviceConfig(f5, f6);
    }

    const config_param = readConfigParameterRAM();
    serial.writeLine("Read config register: " + config_param.toHex() + " Should match 0x3E46");
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

    const ptat = readPtat()
    const ta = m.ta(ptat, configreg)
    console.log(ta)


    const pixels = readIrData()
    //const t0: number[] = []
    //for (let i = 0; i<pixels.length; i++) {
    //    t0.push(null)
    //}

    serial.writeLine(`configreg: ${configreg}`)
    let cr = 0x3e & 3 << 4
    serial.writeLine(`cr ${cr}`)
    let t0 = m.t0(pixels[31], readCompensationPixel(), ta, 3)
    //m.t0allDies(pixels, readCompensationPixel(), ta, configreg, t0)
    serial.writeLine("got t0 " + JSON.stringify(t0))


    // const max = t0.reduce((acc, el) => {
    //     if (el > acc) {
    //         return el
    //     } else {
    //         return acc
    //     }
    // }, -300)
    basic.showNumber(t0)
    // serial.writeLine("ptat: " + ptat.toString());

    // const ta = calculateTA(config, ptat);
    // serial.writeLine("ta : " + ta.toString());
    //readConfigParameterRam()
    basic.pause(1000)
})