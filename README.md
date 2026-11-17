# Kcal · Conteo de calorías con foto

Página web para celular: fotografías tu comida, la IA estima las calorías y todo queda guardado en Supabase.
Front-end estático (GitHub Pages) + Supabase (base de datos, login y función que llama a la IA).

```
index.html                               ← la aplicación (HTML + CSS + JS)
config.js                                ← URL y anon key de Supabase
supabase/schema.sql                      ← tablas y seguridad (RLS)
supabase/functions/analizar-comida/      ← función que envía la foto a la IA
```

## 1. Supabase

1. Crea un proyecto en https://supabase.com.
2. **SQL Editor** → pega `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copia `Project URL` y la `anon public` key en `config.js`.
4. **Authentication → URL Configuration**
   - Site URL: `https://TU-USUARIO.github.io/TU-REPO/`
   - Redirect URLs: agrega la misma URL.
5. **Authentication → Email Templates → Magic Link**: agrega `{{ .Token }}` al cuerpo del correo
   para recibir también un código de 6 dígitos (útil si abres el correo en otra app del celular).

## 2. Función de IA (Edge Function)

Necesitas una clave de IA. **Gratis:** Google Gemini → https://aistudio.google.com/apikey → *Create API key*.
(Alternativa de pago: Claude, clave en https://console.anthropic.com.)

**Opción A, desde el navegador:** Supabase → **Edge Functions → Deploy a new function → Via Editor**,
nombre `analizar-comida`, pega el contenido de `supabase/functions/analizar-comida/index.ts` y despliega.

**Opción B, con la CLI:**
```bash
npx supabase login
npx supabase link --project-ref TU-PROJECT-REF
npx supabase functions deploy analizar-comida
```

Luego, en **Edge Functions → Secrets**, crea:
- `GEMINI_API_KEY` = tu clave de Gemini (opcional `GEMINI_MODEL`, por defecto `gemini-flash-latest`)
- o bien `ANTHROPIC_API_KEY` = tu clave de Claude (opcional `ANTHROPIC_MODEL`, por defecto `claude-haiku-5-5`)

Si existen ambas, se usa Gemini.

La función exige un usuario con sesión iniciada, así que nadie sin cuenta puede gastar tu saldo de IA.

## 3. GitHub Pages

1. Crea un repositorio y sube estos archivos (con `config.js` ya editado).
2. **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. Abre `https://TU-USUARIO.github.io/TU-REPO/` en el celular → ingresa tu correo → código o enlace.
4. Opcional: en el navegador del celular, "Agregar a pantalla de inicio" para usarla como app.

## 4. Cerrar el registro a otras personas (recomendado)

Cuando ya hayas entrado con tu correo: **Authentication → Sign In / Providers → desactiva "Allow new users to sign up"**.
Así solo tu cuenta puede usar la página y la IA.

## Notas

- Las miniaturas (160×160 px, ~10 KB) se guardan en la propia tabla; la foto completa no se almacena.
- La meta diaria se guarda en el navegador (toca "Meta" para cambiarla).
- Las calorías de la IA son una estimación: revísalas y ajústalas antes de guardar.
