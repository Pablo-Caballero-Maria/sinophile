/**
 * Prettier: el formato de TypeScript, CSS, JSON y Markdown, con las clases de Tailwind en su orden
 * recomendado (prettier-plugin-tailwindcss, a partir del tema de src/app/globals.css).
 */
const config = {
  printWidth: 110,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/app/globals.css",
};

export default config;
