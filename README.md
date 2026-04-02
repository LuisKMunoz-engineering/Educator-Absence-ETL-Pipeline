# AppAusentismo - Aplicación de Reporte de Ausentismo

Esta es una aplicación web desarrollada para la Secretaría de Educación del Cauca, diseñada para gestionar, consolidar y verificar los reportes de ausentismo laboral de docentes y personal administrativo en las instituciones educativas.

## Funcionalidad Principal

La aplicación define tres roles de usuario clave, cada uno con un conjunto específico de responsabilidades y permisos para asegurar un flujo de trabajo ordenado y eficiente.

### 1. Rol: Rector (o Director de Institución Educativa)

El Rector es responsable de reportar mensualmente el ausentismo de todo el personal a su cargo.

**Flujo de trabajo:**
1.  **Inicio de Sesión:** Accede al sistema con una credencial genérica.
2.  **Creación del Reporte:** Completa un formulario con sus datos personales y la información de la institución (Municipio, mes del reporte, código DANE).
3.  **Confirmación de Ausentismo:** Debe indicar si hubo o no ausentismo en el mes. Si selecciona "No", el sistema genera un registro que indica que no hubo novedades.
4.  **Carga de Personal:** Si hubo ausentismo, puede cargar automáticamente la lista de personal de su institución introduciendo el código DANE. La aplicación obtiene los datos de un archivo central (`plantaActual.xlsx`).
5.  **Registro de Ausentismo (Formulario Inteligente):**
    *   **Validación de Fechas:** Los calendarios solo permiten seleccionar fechas dentro del mes de reporte, evitando errores.
    *   **Exclusión de Novedades:** El formulario no permite registrar una ausencia por rango de fechas (ej: 2 días) y una por horas en la misma fila. Al llenar un tipo de ausencia, el otro se deshabilita.
    *   **Lógica de Permisos:** El campo "Fecha Autorización Permiso" solo se habilita si se ingresa una "Fecha Solicitud Permiso". Si no hay solicitud, el "Motivo de Permiso" se asigna automáticamente como "No Justificada".
    *   **Gestión Manual:** Puede añadir personal manualmente si no aparece en la carga automática.
6.  **Envío del Reporte:** Al enviar, es redirigido a una página de resumen para confirmar los datos.
7.  **Gestión de Conflictos:** Si el rector intenta enviar un reporte para un mes y una institución que ya tiene un reporte "Enviado" o "Verificado", el sistema le preguntará si desea **sobrescribir** el reporte anterior. Si el reporte anterior fue "Rechazado para corrección", el nuevo envío lo reemplazará automáticamente.
8.  **Página de Éxito:** Tras la confirmación, el reporte se guarda en el archivo consolidado de Excel (`Ausentismo_YYYY-MM.xlsx`) en el servidor y es redirigido a una página de éxito.

### 2. Rol: Director de Núcleo

El Director de Núcleo supervisa un conjunto de instituciones educativas y es el encargado de revisar y validar los reportes enviados por los rectores.

**Flujo de trabajo:**
1.  **Inicio de Sesión:** Ingresa con su correo electrónico y contraseña. El sistema lo identifica y carga la lista de instituciones a su cargo.
2.  **Carga de Reportes:** Selecciona un mes para ver todos los reportes enviados por sus instituciones. Los datos se presentan en modo de **solo lectura**.
3.  **Revisión y Estado:** Cada reporte de institución muestra un estado (`Enviado`, `Verificado`, `Rechazado para corrección`).
4.  **Verificación:** Si la información es correcta, marca la casilla "Reporte Verificado" para esa institución. Puede marcar varias instituciones a la vez.
5.  **Rechazo para Corrección:** Si un reporte tiene errores, puede presionar el botón "Rechazar". Esta acción cambia el estado del reporte a "Rechazado para corrección", borra la fecha de verificación si existía y notifica (conceptualmente) al rector que debe corregir y reenviar su reporte.
6.  **Envío de la Verificación:** Al enviar, la aplicación actualiza el archivo Excel consolidado, añadiendo la fecha y hora de la verificación en la columna "Verificado" y cambiando el estado a "Verificado" para las instituciones seleccionadas.
7.  **Página de Éxito:** Es redirigido a una página que resume las instituciones cuya verificación acaba de enviar.

### 3. Rol: Administrador

El Administrador tiene una visión global del sistema y acceso a todos los datos consolidados para su posterior análisis o procesamiento.

**Flujo de trabajo:**
1.  **Inicio de Sesión:** Accede con credenciales de administrador.
2.  **Descarga de Reportes:** Visualiza una lista de todos los archivos de reporte consolidados por mes, ordenados del más reciente al más antiguo.
3.  **Acceso a Datos:** Puede descargar cualquier archivo `.xlsx`. Estos archivos contienen toda la información enviada por los rectores y actualizada por los directores, con las columnas de fecha en formato `dd/mm/aaaa` para facilitar su uso en Excel.

## Pila Tecnológica

-   **Framework:** Next.js con React (App Router)
-   **Estilos y UI:** Tailwind CSS y componentes de ShadCN UI.
-   **Lógica de Backend:** Genkit para la orquestación de flujos del lado del servidor (procesamiento de archivos Excel).
-   **Almacenamiento (Prototipo):** Archivos `.xlsx` guardados en el sistema de archivos local del servidor (`/storage/reports`).
-   **Autenticación:** Sistema simple basado en roles que utiliza `localStorage` y credenciales estáticas (contraseñas para rector/admin y un archivo Excel para directores).
