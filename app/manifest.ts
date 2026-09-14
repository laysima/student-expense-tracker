import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Xtrack — Student Expense Tracker', short_name: 'Xtrack',
    description: 'Track your spending, income, and monthly limits.',
    start_url: '/dashboard', display: 'standalone', background_color: '#FCFCF9', theme_color: '#28352A',
    icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }],
  }
}
