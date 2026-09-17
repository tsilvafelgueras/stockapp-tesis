// node scripts/test-solicitudes-articulo.cjs <directorio con @electric-sql/pglite>
// Base temporal en memoria: nunca se conecta a Supabase.
const { createRequire } = require('node:module')
const { resolve } = require('node:path')
const { readFileSync } = require('node:fs')
const assert = require('node:assert/strict')
const localRequire = createRequire(resolve(process.argv[2], 'package.json'))
const { PGlite } = localRequire('@electric-sql/pglite')

async function main() {
  const db = new PGlite()
  const empresa = '11111111-1111-4111-8111-111111111111'
  const otra = '22222222-2222-4222-8222-222222222222'
  const operario = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const admin = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const ajeno = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const ventas = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;
    CREATE TABLE empresas(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY, empresa_id uuid, role text);
    CREATE FUNCTION public.current_empresa_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT empresa_id FROM profiles WHERE id=auth.uid() $$;
    CREATE TABLE articulos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid REFERENCES empresas, nombre text NOT NULL, activo boolean DEFAULT true, created_at timestamptz DEFAULT now(), UNIQUE(empresa_id,nombre));
    CREATE TABLE colores(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid REFERENCES empresas, nombre text, activo boolean DEFAULT true);
    CREATE TABLE articulo_colores(empresa_id uuid, articulo_id uuid REFERENCES articulos, color_id uuid REFERENCES colores, UNIQUE(articulo_id,color_id));
    CREATE TABLE notificaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid, tipo text CONSTRAINT notificaciones_tipo_check CHECK(tipo IN ('stock_minimo')), titulo text, mensaje text, articulo_id uuid, resuelta_at timestamptz, leida_at timestamptz);
    CREATE TABLE rollos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), articulo_id uuid, color_id uuid, numero_pieza text, kilos numeric, FOREIGN KEY(articulo_id,color_id) REFERENCES articulo_colores(articulo_id,color_id));
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON articulos TO authenticated;
    ALTER TABLE articulos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY empresa ON articulos TO authenticated USING (empresa_id = current_empresa_id());
    INSERT INTO empresas VALUES ('${empresa}'),('${otra}');
    INSERT INTO auth.users VALUES ('${operario}'),('${admin}'),('${ajeno}'),('${ventas}');
    INSERT INTO profiles VALUES ('${operario}','${empresa}','operario'),('${admin}','${empresa}','admin'),('${ajeno}','${otra}','admin'),('${ventas}','${empresa}','ventas');
    INSERT INTO colores(empresa_id,nombre) VALUES ('${empresa}','Negro'),('${otra}','Azul');
  `)
  await db.exec(readFileSync('supabase/migrations/051_propagate_color_to_articulos.sql','utf8'))
  await db.exec(readFileSync('supabase/migrations/072_solicitudes_articulo.sql','utf8'))
  const asUser = async id => {
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('test.user_id', $1, false)", [id])
    await db.exec('SET ROLE authenticated')
  }
  const solicitar = async nombre => (await db.query('SELECT solicitar_articulo($1) AS result',[nombre])).rows[0].result
  await asUser(operario)
  const vaplex = await solicitar(' VAPLEX  FRISADO ')
  assert.equal(vaplex.pendiente, true)
  assert.equal((await solicitar('vaplex frisado')).id, vaplex.id)
  const cation = await solicitar('CATION PLUS')
  const solicitudes = (await db.query('SELECT * FROM solicitudes_articulo')).rows
  assert.equal(solicitudes.length, 2)
  const solicitud = solicitudes.find(s => s.articulo_id === vaplex.id)
  await assert.rejects(db.query('SELECT aprobar_solicitud_articulo($1)',[solicitud.id]), /administrador/)
  await assert.rejects(db.query("UPDATE solicitudes_articulo SET estado='aprobada'"), /permission denied/)
  await assert.rejects(db.query('UPDATE articulos SET activo=true WHERE id=$1',[vaplex.id]), /primero la solicitud/)
  assert.equal((await db.query('SELECT * FROM articulos WHERE activo')).rows.length, 0)
  await db.exec('RESET ROLE')
  const negro = (await db.query('SELECT id FROM colores WHERE empresa_id=$1',[empresa])).rows[0].id
  for (let i=0;i<16;i++) await db.query('INSERT INTO rollos(articulo_id,color_id,numero_pieza,kilos) VALUES($1,$2,$3,20)',[i<10?vaplex.id:cation.id,negro,String(i)])
  assert.equal((await db.query('SELECT count(*)::int AS n FROM rollos')).rows[0].n,16)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM notificaciones')).rows[0].n,2)
  const blanco = (await db.query("INSERT INTO colores(empresa_id,nombre) VALUES($1,'Blanco') RETURNING id",[empresa])).rows[0].id
  assert.equal((await db.query('SELECT count(*)::int AS n FROM articulo_colores WHERE articulo_id=$1 AND color_id=$2',[vaplex.id,blanco])).rows[0].n,1)
  await db.query("INSERT INTO articulos(empresa_id,nombre,activo) VALUES($1,'Dado de baja',false)",[empresa])
  await asUser(operario)
  await assert.rejects(solicitar('Dado de baja'), /dado de baja/)
  await assert.rejects(solicitar('   '), /nombre debe/)
  await asUser(ajeno)
  assert.equal((await db.query('SELECT * FROM solicitudes_articulo')).rows.length,0)
  await assert.rejects(db.query('SELECT aprobar_solicitud_articulo($1)',[solicitud.id]), /no encontrada/)
  const ajenoArticulo = await solicitar('VAPLEX FRISADO')
  assert.notEqual(ajenoArticulo.id,vaplex.id)
  await asUser(ventas)
  await assert.rejects(solicitar('Nuevo'), /permiso/)
  await asUser(admin)
  await db.query('SELECT aprobar_solicitud_articulo($1)',[solicitud.id])
  await db.query('SELECT aprobar_solicitud_articulo($1)',[solicitud.id])
  assert.equal((await solicitar('VAPLEX FRISADO')).pendiente,false)
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT activo FROM articulos WHERE id=$1',[vaplex.id])).rows[0].activo,true)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM rollos WHERE articulo_id=$1',[vaplex.id])).rows[0].n,10)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM notificaciones WHERE articulo_id=$1 AND resuelta_at IS NOT NULL',[vaplex.id])).rows[0].n,1)
  await db.close()
  console.log('OK: migration, 16 rolls saved pending approval, deduplication, company isolation, roles, activation and notification resolution.')
}
main().catch(error => { console.error(error.message); process.exitCode=1 })
