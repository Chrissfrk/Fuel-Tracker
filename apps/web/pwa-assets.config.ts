import {
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0a74f0' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0a74f0' } },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.35,
        resizeOptions: { background: '#f2f2f7', fit: 'contain' },
        darkResizeOptions: { background: '#000000', fit: 'contain' },
        linkMediaOptions: { log: true, addMediaScreen: true, xhtml: false },
        png: { compressionLevel: 9, quality: 60 },
        name: (landscape, size, dark) =>
          `splash/apple-splash-${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark-' : ''}${size.width}x${size.height}.png`,
      },
      [
        'iPhone SE 4.7"',
        'iPhone 6 Plus',
        'iPhone X',
        'iPhone XR',
        'iPhone 12',
        'iPhone 12 Pro Max',
        'iPhone 14 Pro',
        'iPhone 14 Pro Max',
        'iPhone 16 Pro',
        'iPhone 16 Pro Max',
        'iPad Air 10.9"',
        'iPad Pro 11"',
        'iPad Pro 12.9"',
      ],
    ),
  },
  images: ['public/icon.svg'],
});
