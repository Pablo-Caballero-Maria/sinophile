# Registro de cambios

Todos los cambios relevantes de sinophile se anotan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Cada versión tiene su etiqueta (`vX.Y.Z`) en el
repositorio.

## [Sin publicar]

## [1.1.0] - 2026-11-21

### Añadido

- **Tests de extremo a extremo con Playwright** (`e2e/`, `npm run test:e2e`): 14 tests en Chromium contra el
  build de producción, con la API real y MongoDB: el inicio como invitado, que cada lección de `data/` tenga
  su página con todas sus palabras, el principio de una lección, el modo silencioso, la configuración del
  examen, el diccionario (español, pinyin sin tonos y CC-CEDICT), la ficha de palabra, el traductor, crear
  una cuenta, cerrar sesión y volver a entrar, una contraseña incorrecta y que los ajustes se guarden en la
  cuenta. Cualquier error en la consola del navegador hace fallar el test.
- La CI ejecuta los tests de extremo a extremo con un servicio `mongo:8`.
- **Vercel Web Analytics** (visitas, sin cookies) y **Speed Insights** (Core Web Vitals de visitas reales),
  solo en el build que hace Vercel.

## [1.0.0] - 2026-11-21

### Añadido

- Integración continua con GitHub Actions: validación de `data/`, ESLint, TypeScript, tests con
  cobertura (Vitest + `@vitest/coverage-v8`, resumen en cada ejecución e insignia en el README) y build
  de Next.js en cada *push* y *pull request*.
- `npm run test:coverage`.
- Seguridad: análisis con CodeQL, Dependabot (npm y GitHub Actions), escaneo de secretos con protección
  al hacer *push* y [política de seguridad](SECURITY.md) con avisos privados.
- Licencia [MIT](LICENSE), [código de conducta](CODE_OF_CONDUCT.md), [CITATION.cff](CITATION.cff),
  plantillas de *issues* (error, mejora y error en los datos de una lección) y de *pull request*.
- [Wiki](https://github.com/Pablo-Caballero-Maria/sinophile/wiki) con la arquitectura, el formato de
  los datos, el aprendizaje, la API y el desarrollo.

### Cambiado

- README reorganizado, con insignias, índice, diagramas y capturas.

## [0.6.0] - 2026-11-19

### Añadido

- Lección 6: 早上好, 想, clasificadores, 是什么颜色的 y más colores.

## [0.5.0] - 2026-11-18

### Añadido

- Lección 5.
- **Tu vocabulario** en el inicio: cuántas palabras conoces, cuántas son del HSK 1 y qué parte del HSK 1
  dominas, con la lista de sus 150 palabras (`data/hsk1.json`, `npm run hsk`).

### Cambiado

- `instructions.txt` permite corregir lecciones anteriores.
- Los invitados solo cuentan las palabras que practican, y cada cuenta las que ha practicado.
- Dependencias actualizadas.

## [0.4.0] - 2026-11-14

### Añadido

- Lección 4: presentaciones, la edad, 周/号 y los colores.

## [0.3.0] - 2026-11-06

### Añadido

- **Modo silencioso**: quita los ejercicios de escucha y de pronunciación y apaga los sonidos.
- Escritura libre de hanzi sin corregir, pensada para iPad y Apple Pencil.

### Cambiado

- La lección 2 se divide en las lecciones 2 y 3, según la lista de hanzi de la clase.
- Nuevos colores por tono y correcciones de vocabulario.

## [0.2.0] - 2026-11-04

### Añadido

- Una carpeta por clase (`data/lección N/`) con su `vocab.json` y su `exercises.json`.
- Cuentas con el progreso y los ajustes guardados en MongoDB Atlas, con una pequeña API en
  `src/app/api/` (la web deja de ser 100 % estática), y modo invitado.
- 这里/那里 y la lección del 3 de noviembre.

### Eliminado

- La migración desde `localStorage`: el navegador ya solo guarda la cookie de sesión.

## [0.1.0] - 2026-11-03

### Añadido

- Primera versión, 100 % estática (`output: "export"`): vocabulario por fechas en `data/vocab.json`,
  ejercicios en `data/exercises.json`, repetición espaciada, escritura de hanzi con Hanzi Writer, voz,
  diccionario CC-CEDICT y progreso en el navegador con sincronización opcional con GitHub
  (`progress.json`).
- Node.js 24.x fijado para los builds de Vercel.

[Sin publicar]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.6.0...v1.0.0
[0.6.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Pablo-Caballero-Maria/sinophile/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Pablo-Caballero-Maria/sinophile/releases/tag/v0.1.0
