# AppAusentismo - Aplicación de Reporte de Ausentismo

Esta es una aplicación web desarrollada para la Secretaría de Educación del Cauca, diseñada para gestionar, consolidar y verificar los reportes de ausentismo laboral de docentes y personal administrativo en las instituciones educativas.

## Funcionalidad Principal

La aplicación define tres roles de usuario clave, cada uno con un conjunto específico de responsabilidades y permisos.

### 1. Rol: Rector (o Director de Institución Educativa)

El Rector es responsable de reportar mensualmente el ausentismo de todo el personal a su cargo.

**Flujo de trabajo:**
1.  **Inicio de Sesión:** Accede con su correo electrónico institucional. Sus datos son precargados automáticamente.
2.  **Información Automatizada:** Al ingresar, el sistema ya conoce su Nombre, Municipio, Código DANE e Institución. Estos campos son de solo lectura para evitar errores.
3.  **Confirmación de Ausentismo:** Indica si hubo o no ausentismo en el mes. Si selecciona "No", se genera un registro de "Sin novedades".
4.  **Carga de Personal:** Si hubo ausentismo, carga automáticamente la lista de personal usando el botón "Cargar Planta" (basado en `plantaActual.xlsx`).
5.  **Registro de Ausentismo:** Formulario inteligente con validación de fechas (dentro del mes de reporte) y lógica de exclusión (no permite horas y días en la misma fila).
6.  **Gestión de Conflictos:** Si ya existe un reporte para el mes, el sistema permite anexar registros o sobrescribir el anterior.

### 2. Rol: Director de Núcleo

Supervisa un conjunto de instituciones y valida los reportes enviados por los rectores.

**Flujo de trabajo:**
1.  **Inicio de Sesión:** Accede con su correo y una contraseña gestionada por el administrador.
2.  **Menú de Bienvenida:** Al ingresar, un pop-up le permite elegir entre "Verificar reportes" o "Realizar reporte de Ausentismo ante la SED" (enlace externo).
3.  **Revisión:** Visualiza los reportes de todas las instituciones bajo su cargo para un mes específico.
4.  **Verificación/Rechazo:** Puede marcar reportes como "Verificados" (añadiendo marca de tiempo) o "Rechazados para corrección" (permitiendo al rector editar y reenviar).
5.  **Soportes:** Acceso a una página interna que redirige al formulario oficial de Google para carga de evidencias.

### 3. Rol: Administrador

El Administrador tiene el control total sobre los datos consolidados y la seguridad del sistema.

**Credenciales por defecto:** `admin'

**Funcionalidades:**
1.  **Gestión de Usuarios (Centralizada):**
    *   **Creación/Edición:** Puede crear nuevos Rectores o Directores de Núcleo.
    *   **Asignación de DANE:** Permite asignar múltiples códigos DANE a un solo Director de Núcleo (separados por comas).
    *   **Persistencia:** Los usuarios se guardan en un archivo `users.json` en el servidor, permitiendo cambios de contraseñas y correos en tiempo real.
    *   **Sincronización:** Capacidad de importar inicialmente los usuarios desde los archivos Excel tradicionales.
2.  **Descarga de Reportes:**
    *   Visualiza todos los archivos consolidados (`Ausentismo_YYYY-MM.xlsx`) generados por el sistema.
    *   Descarga directa de archivos para auditoría o carga en sistemas nacionales.

## Pila Tecnológica

-   **Framework:** Next.js con React (App Router)
-   **Estilos y UI:** Tailwind CSS y componentes de ShadCN UI.
-   **Backend:** Genkit para procesamiento de archivos Excel y lógica de negocio.
-   **Almacenamiento:** Archivos `.xlsx` y `.json` en `/storage/reports` y `/storage/users.json`.
-   **Seguridad:** AuthGuard basado en roles y almacenamiento local persistente.
