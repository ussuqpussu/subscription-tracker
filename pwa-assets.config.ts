import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Иконки PWA из public/icon.svg. Перегенерировать: npm run icons
// Исходник — квадрат без скруглений: iOS и Android сами накладывают маску.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
})
