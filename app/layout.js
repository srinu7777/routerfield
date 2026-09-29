import './globals.css';

export const metadata = {
  title: 'Routerfield — Free AI Image & Video Studio',
  description: 'Generate AI images and videos using models from OpenRouter — Flux, Midjourney, Kling, Veo, Seedance and more. Free open-source alternative to Higgsfield AI.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
