/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 主题颜色 - 引用 CSS 变量
        theme: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          background: 'var(--color-background)',
          surface: 'var(--color-surface)',
          'surface-variant': 'var(--color-surface-variant)',
          text: 'var(--color-text)',
          'text-secondary': 'var(--color-text-secondary)',
          border: 'var(--color-border)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          error: 'var(--color-error)',
        },
        // 手机模拟器主题色（保留向后兼容）
        phone: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-error)',
          info: '#5AC8FA',
          dark: 'var(--color-text)',
          light: 'var(--color-background)',
          gray: {
            50: '#F9F9F9',
            100: 'var(--color-background)',
            200: 'var(--color-surface-variant)',
            300: '#D1D1D6',
            400: 'var(--color-border)',
            500: '#AEAEB2',
            600: 'var(--color-text-secondary)',
            700: '#636366',
            800: '#48484A',
            900: '#3A3A3C',
          },
        },
        // 微信主题色
        wechat: {
          green: '#07C160',
          bg: '#EDEDED',
          chat: '#95EC69',
          text: '#353535',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        // 设备相关间距
        'device': 'var(--grid-gap)',
        'master': 'var(--master-width)',
      },
      borderRadius: {
        'phone': '40px',
        'tablet': '24px',
        'desktop': '12px',
        'notch': '20px',
        'app': '12px',
        'bubble': '18px',
        'device': 'var(--device-radius)',
      },
      boxShadow: {
        'phone': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        'tablet': '0 20px 40px -10px rgba(0, 0, 0, 0.3)',
        'desktop': '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
        'app': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'bubble': '0 1px 2px rgba(0, 0, 0, 0.1)',
        'split-divider': 'inset -1px 0 0 0 rgba(0, 0, 0, 0.1)',
      },
      width: {
        'device': 'var(--device-width)',
        'master': 'var(--master-width)',
        'icon': 'var(--icon-size)',
      },
      height: {
        'device': 'var(--device-height)',
        'icon': 'var(--icon-size)',
        'status-bar': 'var(--status-bar-height)',
      },
      minWidth: {
        'master': 'var(--master-width)',
      },
      maxWidth: {
        'master': 'var(--master-width)',
      },
      gridTemplateColumns: {
        'device': 'repeat(var(--grid-columns), 1fr)',
      },
      gap: {
        'device': 'var(--grid-gap)',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-out',
        'slide-out-left': 'slideOutLeft 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-out',
        'zoom-in': 'zoomIn 0.3s ease-out',
        'zoom-out': 'zoomOut 0.3s ease-out',
        'bounce-in': 'bounceIn 0.4s ease-out',
        'ring': 'ring 1.5s ease-in-out infinite',
        'device-switch': 'deviceSwitch 0.3s ease-out',
        'split-slide-in': 'splitSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'split-slide-out': 'splitSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        zoomIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        zoomOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        ring: {
          '0%, 100%': { transform: 'rotate(-10deg)' },
          '50%': { transform: 'rotate(10deg)' },
        },
        deviceSwitch: {
          '0%': { opacity: '0.8', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        splitSlideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        splitSlideOut: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
      },
      zIndex: {
        'phone': '9000',
        'phone-modal': '9100',
        'phone-overlay': '9200',
        'phone-toast': '9300',
      },
    },
  },
  plugins: [],
}