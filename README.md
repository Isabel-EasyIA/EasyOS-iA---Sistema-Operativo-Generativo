# EasyOS iA - Sistema Operativo Generativo

## 🚀 Concepto del Proyecto
EasyOS iA no es un sistema operativo tradicional con aplicaciones preinstaladas. Es una **Interfaz Líquida y Generativa** donde una Inteligencia Artificial (LLM) actúa como el **Kernel (Núcleo)** y el **Arquitecto de UI**.

La interfaz comienza como un "vaciío" (The Void) y se construye a sí misma en tiempo real según las peticiones del usuario. No existen botones estáticos; existen intenciones que la IA traduce en código funcional.

## 🧠 Cómo Funciona (Arquitectura)

1. **El Arquitecto (IA Local):** Utilizamos un servidor de `llama.cpp` (vía HTTP) que recibe instrucciones. La IA tiene un "Manual de Sistema" (System Prompt) que le enseña a usar las herramientas del sistema.
2. **El Kernel (JavaScript):** Un motor ligero que escucha los mensajes de la IA, extrae los bloques de código y los ejecuta de forma segura en el navegador.
3. **API de Primitivas:** El sistema ofrece bloques de construcción básicos:
    - `createWindow`: Para aplicaciones y ventanas complejas.
    - `createIcon`: Para elementos del escritorio (carpetas, archivos).
    - `injectStyle`: Para que la IA cambie el diseño del sistema sobre la marcha.
4. **Bucle de Feedback:** Las acciones del usuario (como hacer doble clic en una carpeta) generan eventos que se envían de vuelta a la IA para que ella decida qué debe suceder a continuación.

## 🛠️ Lo que llevamos creado

- [x] **Interfaz Premium:** Diseño minimalista con Glassmorphism y fondo animado de "Red Neuronal".
- [x] **Motor de Ejecución:** Sistema capaz de interpretar y renderizar código generado por IA en tiempo real.
- [x] **Gestor de Ventanas:** Ventanas arrastrables con controles básicos (cerrar, minimizar).
- [x] **Escritorio Dinámico:** Sistema de iconos de escritorio que se pueden crear y mover.
- [x] **Persistencia:** Guardado automático de la sesión en el navegador (LocalStorage).
- [x] **Interacción de Voz:** Integración con la API de dictado para comandos manos libres.
- [x] **Sistema de Eventos:** El doble clic en iconos dispara peticiones inteligentes a la IA.

---
*Proyecto desarrollado en mayo de 2026. La frontera entre el usuario y la máquina ha desaparecido.*
