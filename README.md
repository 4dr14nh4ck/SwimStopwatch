# 🏊‍♂️ SwimStopwatch - Cronómetro de Natación Nativizado

Un cronómetro minimalista de alta precisión diseñado específicamente para entrenamientos de natación, desarrollado con **React Native** y **Expo**.

## 🚀 Características Especiales
- **Control por Hardware:** Utiliza los botones físicos de volumen del teléfono (`Subir Volumen` para Iniciar/Parar y `Bajar Volumen` para marcar un Split o reiniciar). Ideal para manos mojadas a pie de piscina.
- **Precisión Mecánica:** Evita los desfases de `setInterval` calculando las diferencias mediante marcas de tiempo de alta resolución (`performance.now()`).
- **Pantalla Siempre Activa:** Bloquea la suspensión automática del móvil durante series largas utilizando `expo-keep-awake`.
- **Modo Oscuro Puro:** Interfaz de alto contraste (fondo negro) diseñada para una lectura clara bajo el sol directo de piscinas exteriores.

## 🛠️ Tecnologías utilizadas
- React Native & TypeScript
- Expo (SDK 56)
- React Native Volume Manager (para la captura del hardware de sonido)