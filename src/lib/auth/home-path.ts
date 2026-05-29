export type Role = 'operario' | 'ventas' | 'admin' | 'super'

// Para super-admin con empresa_id_actuando seteada, su "home"
// es el dashboard de admin de la empresa cliente (está operando
// dentro de ella). El rol real sigue siendo 'super'; este es solo
// el destino de navegación cuando termina de operar.
export function homePathForRole(
  role: Role | string | null | undefined,
  empresaActuando?: string | null
): string {
  switch (role) {
    case 'operario':
      return '/operario/dashboard'
    case 'ventas':
      return '/ventas/dashboard'
    case 'admin':
      return '/admin/dashboard'
    case 'super':
      return empresaActuando ? '/admin/dashboard' : '/super'
    default:
      return '/login'
  }
}
