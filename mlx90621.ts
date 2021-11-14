namespace mlx90621 {
    const ta0 = 25

    // Ai(i,j) is an individual pixel offset restored from the EEPROM
    function ai(acommon: number, deltaai: number, deltaaiscale: number, configreg: number): number {
        //console.log(`(${acommon} + ${deltaai} * ${Math.pow(2, deltaaiscale)} / ${Math.pow(2, 3 - configreg)})`)
        return (acommon + deltaai * Math.pow(2, deltaaiscale)) / Math.pow(2, 3 - configreg);
    }

    //exports.ai = ai

    // Bi(i,j) is an individual pixel offset slope coefficient
    function bi(bieeprom: number, biscale: number, configreg: number): number {
        if (bieeprom > 127) {
            bieeprom = bieeprom - 256
        }
        return bieeprom / (Math.pow(2, biscale) * Math.pow(2, 3 - configreg))
    }

    //exports.bi = bi

    function viroffsetcompensated(vir: number, ai: number, bi: number, ta: number): number {
        return vir - (ai + bi * (ta - ta0))
    }

    //exports.viroffsetcompensated = viroffsetcompensated

    function vircpoffsetcompensated(vcp: number, acp: number, bcp: number, ta: number): number {
        //console.log(`vircpoffsetcompensated: ${vcp} - (${acp} + ${bcp} * (${ta} - ${ta0}))`)
        return vcp - (acp + bcp * (ta - ta0))
    }

    ////exports.vircpoffsetcompensated = vircpoffsetcompensated

    function virtgccompensated(viroffsetcompensated: number, tgc: number, vircpoffsetcompensated: number): number {
        return viroffsetcompensated - tgc * vircpoffsetcompensated;
    }

    //exports.virtgccompensated = virtgccompensated

    function vircompensated(virtgccompensated: number, e: number): number {
        return virtgccompensated / e
    }
    //exports.vircompensated = vircompensated

    function ksta(ksta: number): number {
        return ksta / Math.pow(2, 20)
    }

    //exports.ksta = ksta

    function sigma(sigma: number, sigmascale: number, deltasigma: number, deltasigmascale: number, configreg: number): number {
        return ((sigma / Math.pow(2, sigmascale)) + (deltasigma / Math.pow(2, deltasigmascale))) / Math.pow(2, 3 - configreg)
    }

    //exports.sigma = sigma

    function sigmacp(sigmacp: number, sigmascale: number, configreg: number) {
        return sigmacp / (Math.pow(2, sigmascale) * Math.pow(2, 3 - configreg))
    }

    //exports.sigmacp = sigmacp

    function sigmacomp(ksta: number, ta: number, sigma: number, tgc: number, sigmacp: number): number {
        return (1 + ksta * (ta - ta0)) * (sigma - tgc * sigmacp)
    }

    //exports.sigmacomp = sigmacomp

    function ks(ks: number, ksscale: number): number {
        ks = (ks > 127) ? ks - 256 : ks
        return ks / Math.pow(2, ksscale + 8)
    }

    //exports.ks = ks

    function tak(ta: number): number {
        return Math.pow(ta + 273.15, 4)
    }

    //exports.tak = tak

    function sx(ks: number, sigmacomp: number, vircompensated: number, tak: number): number {
        return ks * Math.pow(Math.pow(sigmacomp, 3) * vircompensated + Math.pow(sigmacomp, 4) * tak, 1 / 4)
    }
    //exports.sx = sx

    function t0(vircompensated: number, sigmacomp: number, ks: number, sx: number, tak: number): number {
        return Math.pow((vircompensated / (sigmacomp * (1 - (ks * 273.15 + sx))) + tak), 1 / 4) - 273.15
    }
    //exports.t0 = t0

    function calculateVirOffsetCompensated(
        v: number,
        acommon: number,
        deltaai: number,
        aiscale: number,
        bieeprom: number,
        biscale: number,
        ta: number,
        configreg: number
    ): number {
        const a = ai(acommon, deltaai, aiscale, configreg)
        const b = bi(bieeprom, biscale, configreg)
        return viroffsetcompensated(v, a, b, ta)
    }

    function calculateTgc(
        voc: number,
        tgceeprom: number,
        vcp: number,
        acph: number,
        acpl: number,
        bcpee: number,
        biscale: number,
        ta: number,
        e: number,
        configreg: number,
    ): number {
        const tgc = tgceeprom / 32
        const acp = (256 * acph + acpl) / Math.pow(2, 3 - configreg)
        const bcp = (bcpee > 127 ? bcpee - 256 : bcpee) / (Math.pow(2, biscale) * Math.pow(2, 3 - configreg))
        const vcpoffsetcompensated = vircpoffsetcompensated(vcp, acp, bcp, ta)
        const vtgccompensated = virtgccompensated(voc, tgc, vcpoffsetcompensated)
        return vircompensated(vtgccompensated, e)
    }

    function toSignedByte(b: number): number {
        return b > 127 ? b - 256 : b
    }
    //exports.toSignedByte = toSignedByte

    function toSignedDouble(h: number, l: number): number {
        const i = h * 256 + l
        return (i > 32767) ? i - 65536 : i
    }
    //exports.toSignedDouble = toSignedDouble

    function toUnsignedDouble(h: number, l: number): number {
        return h * 256 + l
    }
    //exports.toUnsignedDouble = toUnsignedDouble

    export class MLX90261 {

        deltaA: number
        bi: number
        deltaSigma: number
        kScale: number
        k: number
        aCommon: number
        aCP: number
        bCP: number
        sigmaCP: number
        tgcEeprom: number
        deltaAiScale: number
        biScale: number
        sigma0: number
        sigma0Scale: number
        deltaSigmaScale: number
        e: number
        ksTa: number
        vth: number
        kt1: number
        kt2: number
        kt1scale: number
        kt2scale: number

        constructor(
            deltaA: number,
            bi: number,
            deltaSigma: number,
            kScale: number,
            k: number,
            aCommonL: number,
            aCommonH: number,
            aCPL: number,
            aCPH: number,
            bCP: number,
            sigmaCPL: number,
            sigmaCPH: number,
            tgcEeprom: number,
            deltaAiScaleBiScale: number,
            sigma0L: number,
            sigma0H: number,
            sigma0Scale: number,
            deltaSigmaScale: number,
            eL: number,
            eH: number,
            ksTaL: number,
            ksTaH: number,
            vthL: number,
            vthH: number,
            kt1L: number,
            kt1H: number,
            kt2L: number,
            kt2H: number,
            ktscale: number
        ) {
            this.deltaA = deltaA
            this.bi = toSignedByte(bi)
            this.deltaSigma = deltaSigma
            this.kScale = kScale & 0x0f
            this.k = toSignedByte(k)
            this.aCommon = toSignedDouble(aCommonH, aCommonL)
            this.aCP = toSignedDouble(aCPH, aCPL)
            this.bCP = toSignedByte(bCP)
            this.sigmaCP = toUnsignedDouble(sigmaCPH, sigmaCPL)
            this.tgcEeprom = toSignedByte(tgcEeprom)
            this.deltaAiScale = deltaAiScaleBiScale >> 4
            this.biScale = deltaAiScaleBiScale & 0x0f
            this.sigma0 = toUnsignedDouble(sigma0H, sigma0L)
            this.sigma0Scale = sigma0Scale
            this.deltaSigmaScale = deltaSigmaScale
            this.e = toUnsignedDouble(eH, eL)
            this.ksTa = toSignedDouble(ksTaH, ksTaL)
            this.kt1 = toUnsignedDouble(kt1H, kt1L)
            this.kt2 = toUnsignedDouble(kt2H, kt2L)
            this.vth = toSignedDouble(vthH, vthL)
            this.kt1scale = (ktscale & 0xF0) >> 4
            this.kt2scale = ktscale & 0x0F
        }

        ta(
            patatData: number,
            configreg: number
        ): number {
            const kt1 = this.kt1 / (Math.pow(2, this.kt1scale) * Math.pow(2, 3 - configreg))
            const kt2 = this.kt2 / (Math.pow(2, this.kt2scale + 10) * Math.pow(2, 3 - configreg))

            return (-kt1 + Math.sqrt(Math.pow(kt1, 2) - 4 * kt2 * (this.vth - patatData))) / (2 * kt2) + 25
        }

        t0(
            v: number,
            vcp: number,
            ta: number,
            configreg: number // bits 5:4 from the configreg
        ): number {
            const tgc = this.tgcEeprom / 32
            v = (v > 32768) ? v - 65536 : v
            vcp = (vcp > 32768) ? vcp - 65536 : vcp

            //console.log(`v: ${v} vcp: ${vcp}`)

            const k = ksta(this.ksTa)
            const sig = sigma(this.sigma0, this.sigma0Scale, this.deltaSigma, this.deltaSigmaScale, configreg)
            const sigcp = sigmacp(this.sigmaCP, this.sigma0Scale, configreg)
            const sigmaComp = sigmacomp(k, ta, sig, tgc, sigcp)
            //console.log(`sigmacomp: ${sigmaComp}`)

            const a = ai(this.aCommon, this.deltaA, this.deltaAiScale, configreg)
            const b = bi(this.bi, this.biScale, configreg)
            const voc = viroffsetcompensated(v, a, b, ta)
            const e = this.e / 32768

            const acp = this.aCP / Math.pow(2, 3 - configreg)
            const bcp = this.bCP / (Math.pow(2, this.biScale) * Math.pow(2, 3 - configreg))
            const vcpoffsetcompensated = vircpoffsetcompensated(vcp, acp, bcp, ta)
            const vgccompensated = virtgccompensated(voc, tgc, vcpoffsetcompensated)
            const vcompensated = vircompensated(vgccompensated, e)
            //console.log(`vircompensated: ${vcompensated}`)
            const ks = this.k / Math.pow(2, this.kScale + 8)
            const taK = tak(ta)

            const sx = ks * Math.pow(Math.pow(sigmaComp, 3) * vcompensated + Math.pow(sigmaComp, 4) * taK, 1 / 4)
            //console.log(`sx: ${sx}`)
            return Math.pow((vcompensated / (sigmaComp * (1 - ks * 273.15) + sx)) + taK, 1 / 4) - 273.15
        }

        t0allDies(
            vir: number[],
            vcp: number,
            ta: number,
            configreg: number,
            to: number[]
        ) {
            
            vir.forEach((v, i) => {
                to[i] = this.t0(v, vcp, ta, configreg)
            })
        }
    }
}