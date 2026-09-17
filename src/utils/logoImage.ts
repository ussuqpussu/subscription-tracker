import { isValidLogo, LOGO_SIZE } from './logo'

export class LogoError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new LogoError('Не получилось открыть картинку.'))
    }
    image.src = url
  })
}

/**
 * Картинка из файла → квадрат 128×128 (центральная часть, как у иконки) в data URL.
 * WebP меньше всего; если браузер его не умеет, выходит PNG, а слишком тяжёлый PNG заменяется JPEG.
 */
export async function readLogoFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new LogoError('Выберите файл с картинкой.')
  const image = await loadImage(file)
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  if (side === 0) throw new LogoError('Не получилось открыть картинку.')

  const canvas = document.createElement('canvas')
  canvas.width = LOGO_SIZE
  canvas.height = LOGO_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new LogoError('Не получилось обработать картинку.')
  context.imageSmoothingQuality = 'high'
  const draw = () =>
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      LOGO_SIZE,
      LOGO_SIZE,
    )
  draw()

  let result = canvas.toDataURL('image/webp', 0.9)
  if (!isValidLogo(result)) {
    // JPEG без прозрачности: подкладываем белый фон, как у большинства иконок.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, LOGO_SIZE, LOGO_SIZE)
    draw()
    result = canvas.toDataURL('image/jpeg', 0.85)
  }
  if (!isValidLogo(result)) throw new LogoError('Картинка слишком большая даже после сжатия.')
  return result
}
