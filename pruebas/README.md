# Pruebas

29 pruebas que abren la web en un Chromium de verdad y comprueban lo que se ve,
no lo que debería verse.

```bash
python3 -m http.server 8777      # desde la raíz, en otra terminal
node pruebas/ejecutar.js         # las 29, alrededor de un minuto
node pruebas/ejecutar.js ficha   # solo las que contengan «ficha»
```

Sale **0** si pasan todas, **1** si falla alguna y **2** si no encuentra el
servidor.

**Playwright vive aquí y no en la raíz**, para que la web siga sin
dependencias. Es a propósito: no lo subas un nivel.

Si el entorno ya trae el navegador y no deja descargar otro:

```bash
CHROMIUM=/opt/pw-browsers/chromium node pruebas/ejecutar.js
```

## Qué cubre

| Grupo | Qué comprueba |
|---|---|
| **Carga** | que no hay errores de consola al arrancar |
| **Hoy** | que acierta con lo que toca hoy según el calendario, hoy sea el día que sea |
| **Calendario** | que lista las 66 sesiones, que separa los bloques y que «sin partido» solo aparece donde el calendario de competición lo dice |
| **Ficha** | que los bloques cubren la sesión sin huecos, que la altura es proporcional, que el cronómetro arranca y marca el bloque en curso, que cambiar de sesión lo reinicia, que las pizarras se despliegan sin `NaN`, que cada pizarra usa su propio marcador de flecha, que el panel de montaje trae errores frecuentes y que la víspera avisa |
| **Familias** | que están todas, que los grupos suman el total y que el buscador no pierde lo tecleado |
| **Ejercicio** | que trae pizarra y montaje, que enlaza a todas las sesiones donde aparece y que enseña la consigna de la otra cara |
| **Plan** | que los diez documentos se abren con contenido y que no entra HTML del original sin escapar |
| **Rotaciones** | que con cualquier convocatoria de 5 a 12 cada tanda lleva cinco y nadie baja del mínimo si da, que las reglas de grupo y de minutos se cumplen o se avisa, que una regla se crea desde la pantalla y entra en el reparto, que una baja recalcula el resto sin tocar lo jugado, y que la plantilla sobrevive a recargar sin que el primer toque en «Repartir» se pierda |
| **Bordes** | que una ruta inventada avisa, y que al imprimir se despliega todo y desaparece el cronómetro |

## Al escribir una nueva

**No fijes cifras que dependan del contenido.** «Espera 66 sesiones» caduca en
cuanto se toque un documento. Comprueba propiedades —que los bloques no dejen
huecos, que los tres grupos sumen el total— y saca los números del propio JSON,
que es lo que hacen todas las de aquí.

Usa `ir()` para la primera visita de cada prueba e `irSinRecargar()` para
moverte después: cada prueba abre una pestaña nueva, y navegar sin haber
cargado nada te deja trabajando sobre una página en blanco.
