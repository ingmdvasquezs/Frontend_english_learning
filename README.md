# English Reading Platform — Frontend

Frontend Angular de una plataforma de lectura en inglés que adapta la experiencia al vocabulario del usuario.

## Stack

- Angular con arquitectura standalone
- Angular Signals
- Tailwind CSS
- Integración con backend SOAP
- Vitest

## Funcionalidades actuales

- Registro, autenticación y onboarding inicial de vocabulario
- Home con recomendaciones y lecturas en progreso
- Biblioteca de lecturas del usuario y registro de nuevas lecturas
- Reader interactivo para textos USER y PLATFORM
- Clasificación de palabras como `KNOWN`, `LEARNING`, `NEW` o `IGNORED`
- Diccionario, traducción y pronunciación
- Progreso y finalización de lecturas
- Temas light y dark persistentes

## Ejecución local

Requisitos: Node.js y npm compatibles con las versiones declaradas en `package.json`.

```bash
npm install
ng serve --proxy-config proxy.conf.json
```

La aplicación estará disponible en [http://localhost:4200](http://localhost:4200).

Las operaciones SOAP requieren que el backend de English Reading Platform esté ejecutándose y sea accesible mediante `proxy.conf.json`.

## Validación

```bash
npm test -- --watch=false
npm run build
```
