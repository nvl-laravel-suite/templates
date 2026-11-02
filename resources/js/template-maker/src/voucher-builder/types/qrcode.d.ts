declare module 'qrcode' {
  export interface QrCodeModules {
    size: number
    get(row: number, col: number): boolean
  }

  export interface QrCodeModel {
    modules: QrCodeModules
  }

  export interface CreateOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  }

  const QRCode: {
    create(value: string, options?: CreateOptions): QrCodeModel
  }

  export default QRCode
}
